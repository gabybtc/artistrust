import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

export async function DELETE(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Authenticate caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id
  const errors: string[] = []

  // 1. Cancel Stripe subscription (if any), so they aren't charged again
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .single()

  if (subRow?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(subRow.stripe_subscription_id)
    } catch {
      // Non-fatal — subscription may already be cancelled
    }
  }

  // 2. Delete all files from storage bucket artworks/{userId}/
  const { data: files, error: listErr } = await admin.storage
    .from('artworks')
    .list(userId, { limit: 1000 })

  if (listErr) {
    errors.push(`storage list: ${listErr.message}`)
  } else if (files && files.length > 0) {
    const paths = files.map(f => `${userId}/${f.name}`)
    const { error: removeErr } = await admin.storage.from('artworks').remove(paths)
    if (removeErr) errors.push(`storage remove: ${removeErr.message}`)
  }

  // 3. Delete database rows (order matters for FK constraints)
  const tables: Array<{ table: string; col: string }> = [
    { table: 'artworks',         col: 'user_id' },
    { table: 'catalogue_access', col: 'owner_id' },
    { table: 'subscriptions',    col: 'user_id' },
    { table: 'user_settings',    col: 'user_id' },
  ]
  for (const { table, col } of tables) {
    const { error } = await admin.from(table).delete().eq(col, userId)
    if (error) errors.push(`${table}: ${error.message}`)
  }

  // 4. Delete the Supabase Auth user — this is irreversible
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserErr) {
    return NextResponse.json(
      { error: `Failed to delete auth user: ${deleteUserErr.message}`, partialErrors: errors },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, partialErrors: errors.length ? errors : undefined })
}
