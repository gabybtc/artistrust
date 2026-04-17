import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'ArtisTrust <hello@artistrust.io>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.artistrust.io'

function makeToken(userId: string, email: string): string {
  return crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${userId}:${email}`)
    .digest('hex')
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, skipped: true })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  // Authenticate via Supabase access token
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Skip if already verified
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const { data: settings } = await admin
    .from('user_settings')
    .select('profile')
    .eq('user_id', user.id)
    .single()
  if ((settings?.profile as { emailVerified?: boolean } | null)?.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  const token = makeToken(user.id, user.email)
  const verifyUrl = `${SITE}/api/email/verify?uid=${encodeURIComponent(user.id)}&token=${token}`

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: 'Verify your ArtisTrust email address',
    html: buildHtml(verifyUrl),
  })

  if (sendError) {
    console.error('Verify email error:', sendError)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function buildHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verify your email — ArtisTrust</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e8e8e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#141414;border:1px solid #2a2a2a;border-radius:2px;">

          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-style:italic;font-weight:400;letter-spacing:0.02em;">
                <span style="color:#e8e8e8;">Artis</span><span style="color:#c9a96e;">Trust</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 40px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#e8e8e8;line-height:1.5;">
                Verify your email address
              </p>
              <p style="margin:0 0 28px;font-size:13px;color:#888;line-height:1.8;">
                Click the button below to confirm your email and unlock all ArtisTrust features.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${verifyUrl}" style="display:inline-block;padding:11px 28px;background:#c9a96e;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:11px;color:#555;line-height:1.7;">
                If you didn&apos;t create an ArtisTrust account, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
