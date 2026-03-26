import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getSubscription } from '@/lib/db'
import { getLegacyUploadFee } from '@/lib/plans'
import type { Plan, BillingInterval } from '@/lib/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

const PRICE_MAP: Record<string, string> = {
  studio_monthly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY  ?? '',
  studio_annual:   process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_ANNUAL   ?? '',
  archive_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ARCHIVE_MONTHLY ?? '',
  archive_annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_ARCHIVE_ANNUAL  ?? '',
}

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // Authenticate the request via the Authorization header (Supabase JWT)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    type: 'subscription' | 'legacy'
    plan?: Plan
    interval?: BillingInterval
    workCount?: number
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // ── Subscription checkout ─────────────────────────────────────────────────
  if (body.type === 'subscription') {
    const { plan, interval } = body
    if (!plan || !interval) return NextResponse.json({ error: 'Missing plan/interval' }, { status: 400 })

    const priceKey = `${plan}_${interval}`
    const priceId = PRICE_MAP[priceKey]
    if (!priceId) return NextResponse.json({ error: `No price configured for ${priceKey}` }, { status: 400 })

    // Retrieve or create Stripe customer tied to this user
    const sub = await getSubscription(user.id)
    let customerId = sub?.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}?billing=success`,
      cancel_url: `${siteUrl}?billing=cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan, interval },
      },
      metadata: { supabase_user_id: user.id, plan, interval },
    })

    return NextResponse.json({ url: session.url })
  }

  // ── Legacy upload one-time payment ────────────────────────────────────────
  if (body.type === 'legacy') {
    const { workCount } = body
    if (!workCount || workCount < 1) return NextResponse.json({ error: 'Invalid workCount' }, { status: 400 })

    const sub = await getSubscription(user.id)
    const { cents, tier } = getLegacyUploadFee(workCount, sub?.plan ?? 'preserve', sub?.billingInterval ?? null)

    // Free — nothing to charge; record as paid immediately
    if (cents === 0) {
      await admin.from('legacy_upload_orders').insert({
        user_id: user.id,
        work_count_tier: tier,
        amount_cents: 0,
        status: 'free',
      })
      return NextResponse.json({ free: true })
    }

    let customerId = sub?.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }

    // For 501+ we use a dynamic amount; otherwise fixed price
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Legacy Archive Upload (${tier} works)` },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}?legacy=success`,
      cancel_url: `${siteUrl}?legacy=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        legacy_upload: 'true',
        work_count_tier: tier,
        amount_cents: String(cents),
      },
    })

    // Pre-record as pending; webhook will mark it paid
    await admin.from('legacy_upload_orders').insert({
      user_id: user.id,
      stripe_payment_intent_id: session.payment_intent as string | null,
      work_count_tier: tier,
      amount_cents: cents,
      status: 'pending',
    })

    return NextResponse.json({ url: session.url })
  }

  return NextResponse.json({ error: 'Unknown checkout type' }, { status: 400 })
}
