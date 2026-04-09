import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Plan, BillingInterval } from '@/lib/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!serviceKey || !webhookSecret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const sig = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? '', webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  switch (event.type) {
    // ── Checkout completed ──────────────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      // Subscription checkout
      if (session.mode === 'subscription' && session.subscription) {
        const plan      = session.metadata?.plan     as Plan | undefined
        const interval  = session.metadata?.interval as BillingInterval | undefined
        const customerId = session.customer as string

        await admin.from('subscriptions').upsert({
          user_id: userId,
          plan: plan ?? 'studio',
          billing_interval: interval ?? 'monthly',
          stripe_customer_id: customerId,
          stripe_subscription_id: session.subscription as string,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }

      // Setup mode — card saved by a Preserve user for overage payments
      if (session.mode === 'setup') {
        const customerId = session.customer as string
        const setupIntent = session.setup_intent as string | null

        // Set the saved card as the customer's default payment method
        if (setupIntent) {
          const si = await stripe.setupIntents.retrieve(setupIntent)
          const pm = si.payment_method as string | null
          if (pm) {
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pm },
            })
          }
        }

        // Ensure the customer ID is persisted for users who had no prior subscription row
        await admin.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }

      break
    }

    // ── Subscription updated (plan change, renewal, etc.) ──────────────────
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break

      const plan     = sub.metadata?.plan     as Plan | undefined
      const interval = sub.metadata?.interval as BillingInterval | undefined
      const periodEnd = new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000).toISOString()

      await admin.from('subscriptions').upsert({
        user_id: userId,
        plan: plan ?? 'studio',
        billing_interval: interval ?? 'monthly',
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }

    // ── Subscription cancelled / expired ──────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break

      // Keep current_period_end so the user retains access until their paid period expires.
      // A scheduled job / next login will downgrade them once the date passes.
      const periodEnd = sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
        : null

      await admin.from('subscriptions').upsert({
        user_id: userId,
        plan: 'preserve',
        billing_interval: null,
        stripe_subscription_id: null,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }

    // ── Overage payment succeeded ──────────────────────────────────────────
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      // Only handle overage payments tagged by our route — no DB action needed;
      // uploads are already queued client-side on confirmOverage().
      if (pi.metadata?.type !== 'overage') break
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
