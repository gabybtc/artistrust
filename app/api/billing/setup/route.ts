import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getSubscription } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

/**
 * Creates a Stripe Checkout session in "setup" mode.
 * This saves a payment method without charging — used by Preserve plan users
 * so they can pay for overage uploads without upgrading to a paid plan.
 */
export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // Get or create a Stripe customer for this user
  const sub = await getSubscription(user.id, admin)
  let customerId = sub?.stripeCustomerId ?? undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    // Persist the new customer ID immediately
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      plan: sub?.plan ?? 'preserve',
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    success_url: `${siteUrl}/?card=saved`,
    cancel_url: `${siteUrl}/`,
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
