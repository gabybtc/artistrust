import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Plan, BillingInterval } from '@/lib/plans'
import type { UserSubscription } from '@/lib/types'

export async function GET(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Always cross-check beta_emails so users added after signup get beta access automatically
  const { data: betaRow } = await admin
    .from('beta_emails')
    .select('email')
    .eq('email', user.email ?? '')
    .maybeSingle()
  const isBeta = !!(betaRow || data?.is_beta)

  if (error || !data) {
    // Return default preserve plan if no subscription record found
    const fallback: UserSubscription = {
      userId: user.id,
      plan: isBeta ? 'beta' : 'preserve',
      billingInterval: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      isBeta,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return NextResponse.json(fallback)
  }

  // Self-heal: if email is now in beta_emails but the DB row hasn't been updated yet, fix it
  if (isBeta && (!data.is_beta || data.plan !== 'beta')) {
    await admin.from('subscriptions').update({
      plan: 'beta',
      is_beta: true,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  }

  const sub: UserSubscription = {
    userId: data.user_id,
    plan: isBeta ? 'beta' : (data.plan as Plan),
    billingInterval: (data.billing_interval as BillingInterval | null) ?? null,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    isBeta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }

  return NextResponse.json(sub)
}
