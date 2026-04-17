import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.artistrust.io'

function makeToken(userId: string, email: string): string {
  return crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${userId}:${email}`)
    .digest('hex')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  if (!uid || !token) {
    return NextResponse.redirect(`${SITE}/?verifyError=invalid`)
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.redirect(`${SITE}/?verifyError=config`)

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const { data: { user }, error } = await admin.auth.admin.getUserById(uid)
  if (error || !user?.email) return NextResponse.redirect(`${SITE}/?verifyError=invalid`)

  // Constant-time token comparison
  const expected = makeToken(uid, user.email)
  let valid = false
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(token.padEnd(64, '0').slice(0, 64), 'hex'),
      Buffer.from(expected, 'hex'),
    ) && token.length === expected.length
  } catch {
    valid = false
  }
  if (!valid) return NextResponse.redirect(`${SITE}/?verifyError=invalid`)

  // Merge emailVerified into the existing profile jsonb
  const { data: settings } = await admin
    .from('user_settings')
    .select('profile')
    .eq('user_id', uid)
    .single()
  const profile = { ...(settings?.profile ?? {}), emailVerified: true }
  await admin
    .from('user_settings')
    .upsert({ user_id: uid, profile }, { onConflict: 'user_id' })

  return NextResponse.redirect(`${SITE}/?emailVerified=true`)
}
