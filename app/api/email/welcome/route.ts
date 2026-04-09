import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'ArtisTrust <hello@artistrust.io>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.artistrust.io'

export async function POST(req: NextRequest) {
  // Only fire if Resend is configured — silently succeed otherwise so
  // signup flow isn't broken on dev environments without the key.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: { user }, error: authError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const name = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there'

  const { error } = await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: 'Welcome to ArtisTrust — your archive awaits',
    html: buildHtml(name),
  })

  if (error) {
    console.error('Welcome email error:', error)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function buildHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to ArtisTrust</title>
</head>
<body style="margin:0; padding:0; background:#0a0a0a; color:#e8e8e8; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:300;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#141414; border:1px solid #2a2a2a; border-radius:2px;">

          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 28px; border-bottom:1px solid #2a2a2a; text-align:center;">
              <p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:22px; font-style:italic; font-weight:400; color:#e8e8e8; letter-spacing:0.02em;">
                ArtisTrust
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 22px; font-size:24px; font-family:Georgia,'Times New Roman',serif; font-style:italic; font-weight:400; color:#e8e8e8; line-height:1.3;">
                Welcome, ${name}.
              </p>

              <p style="margin:0 0 16px; font-size:14px; color:#888; line-height:1.8;">
                Your archive is ready. ArtisTrust is a private, permanent home for your artwork — everything in one place, catalogued with the care your work deserves.
              </p>

              <p style="margin:0 0 32px; font-size:14px; color:#888; line-height:1.8;">
                Here&apos;s how to get started:
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ['Upload your first work', 'Drag and drop images — JPG, PNG, TIFF, or RAW. The AI will analyse each piece and suggest a title, tags, and description.'],
                  ['Complete the catalogue entry', 'Add year, medium, dimensions, and location. The more you fill in now, the more useful your archive becomes over time.'],
                  ['Set up your legal designee', 'Under the Legal tab, nominate someone to manage your archive if anything ever happens to you. This is the most important thing most artists never do.'],
                  ['Add your profile', 'Your name and statement carry through to your shareable portfolio and copyright documentation.'],
                ].map(([title, desc], i) => `
                <tr>
                  <td style="padding-bottom:22px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="24" valign="top" style="padding-top:1px;">
                          <span style="display:inline-block; width:18px; height:18px; background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); border-radius:2px; text-align:center; font-size:10px; line-height:18px; color:#c9a96e; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${i + 1}</span>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0 0 4px; font-size:13px; font-weight:500; color:#e8e8e8; letter-spacing:0.02em;">${title}</p>
                          <p style="margin:0; font-size:13px; color:#666; line-height:1.7;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  <td>
                    <a href="${SITE}" style="display:inline-block; padding:12px 28px; background:#c9a96e; color:#0a0a0a; font-size:12px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; text-decoration:none; border-radius:2px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                      Open My Archive
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rule -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px; background:linear-gradient(90deg,transparent,#8a6f3e,transparent); opacity:0.4;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 8px; font-size:11px; color:#555; line-height:1.7; letter-spacing:0.03em;">
                Your images are stored on AWS S3 (US), encrypted at rest and in transit.
                We claim no rights to your work — your IP is yours, always.
              </p>
              <p style="margin:0; font-size:11px; color:#444;">
                <a href="${SITE}/privacy" style="color:#666; text-decoration:none;">Privacy Policy</a>
                &nbsp;·&nbsp;
                <a href="${SITE}/terms" style="color:#666; text-decoration:none;">Terms of Service</a>
                &nbsp;·&nbsp;
                <a href="mailto:hello@artistrust.io" style="color:#666; text-decoration:none;">hello@artistrust.io</a>
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
