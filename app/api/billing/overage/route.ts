import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getSubscription } from '@/lib/db'
import { OVERAGE_COST_USD } from '@/lib/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // Authenticate via Supabase JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate count
  const body = await req.json() as { count?: unknown }
  const count = Math.max(1, Math.floor(Number(body.count) || 1))

  // Look up Stripe customer
  const sub = await getSubscription(user.id, admin)
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'no_payment_method' }, { status: 402 })
  }

  // Retrieve customer's default payment method
  const customer = await stripe.customers.retrieve(sub.stripeCustomerId)
  if ((customer as Stripe.DeletedCustomer).deleted) {
    return NextResponse.json({ error: 'no_payment_method' }, { status: 402 })
  }
  const c = customer as Stripe.Customer
  const defaultPm =
    (c.invoice_settings?.default_payment_method as string | null) ??
    (c.default_source as string | null)

  if (!defaultPm) {
    return NextResponse.json({ error: 'no_payment_method' }, { status: 402 })
  }

  const amountCents = Math.round(count * OVERAGE_COST_USD * 100)

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: sub.stripeCustomerId,
      payment_method: defaultPm,
      confirm: true,
      off_session: true,
      description: `ArtisTrust overage — ${count} upload${count === 1 ? '' : 's'}`,
      metadata: {
        supabase_user_id: user.id,
        upload_count: String(count),
        type: 'overage',
      },
    })

    if (pi.status === 'succeeded') {
      return NextResponse.json({ ok: true, paymentIntentId: pi.id })
    }

    // requires_action / requires_confirmation — can't handle off-session
    return NextResponse.json(
      { error: 'payment_requires_action', status: pi.status },
      { status: 402 },
    )
  } catch (err) {
    const stripeErr = err as Stripe.StripeRawError
    return NextResponse.json(
      { error: stripeErr.code ?? 'payment_failed', message: stripeErr.message ?? 'Payment failed' },
      { status: 402 },
    )
  }
}
