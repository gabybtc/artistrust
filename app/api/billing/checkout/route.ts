import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getSubscription } from '@/lib/db'
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
    type: 'subscription'
    plan?: Plan
    interval?: BillingInterval
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // ── Subscription checkout ─────────────────────────────────────────────────
  if (body.type === 'subscription') {
    const { plan, interval } = body
    if (!plan || !interval) return NextResponse.json({ error: 'Missing plan/interval' }, { status: 400 })

    const sub = await getSubscription(user.id)

    // ── Downgrade to preserve: cancel the Stripe subscription ────────────
    if (plan === 'preserve') {
      if (!sub?.stripeSubscriptionId) {
        // Already on preserve (no active subscription to cancel)
        return NextResponse.json({ updated: true })
      }
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      await admin.from('subscriptions').upsert({
        user_id: user.id,
        plan: 'preserve',
        billing_interval: null,
        stripe_customer_id: sub.stripeCustomerId,
        stripe_subscription_id: sub.stripeSubscriptionId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      return NextResponse.json({ updated: true })
    }

    const priceKey = `${plan}_${interval}`
    const priceId = PRICE_MAP[priceKey]
    if (!priceId) return NextResponse.json({ error: `No Stripe price configured for ${priceKey}. Set NEXT_PUBLIC_STRIPE_PRICE_${(plan + '_' + interval).toUpperCase()} in your environment.` }, { status: 400 })

    // ── Plan switch: user already has an active subscription ─────────────
    if (sub?.stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
      const itemId = stripeSub.items.data[0]?.id
      if (!itemId) return NextResponse.json({ error: 'No subscription item found' }, { status: 400 })

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { supabase_user_id: user.id, plan, interval },
      })

      // Update DB immediately (webhook will also fire and reconcile)
      await admin.from('subscriptions').upsert({
        user_id: user.id,
        plan,
        billing_interval: interval,
        stripe_customer_id: sub.stripeCustomerId,
        stripe_subscription_id: sub.stripeSubscriptionId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      return NextResponse.json({ updated: true })
    }

    // ── New subscription: create Stripe checkout session ─────────────────
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

  return NextResponse.json({ error: 'Unknown checkout type' }, { status: 400 })
}
