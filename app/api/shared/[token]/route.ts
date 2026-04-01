import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canSharePortfolio } from '@/lib/plans'
import type { Plan } from '@/lib/plans'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Shared catalog access is not configured on this server.' },
      { status: 503 },
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

  // Validate token and fetch grant
  const { data: grant, error: grantError } = await admin
    .from('catalogue_access')
    .select('owner_id, grantee_name, grantee_email')
    .eq('token', token)
    .single()

  if (grantError || !grant) {
    return NextResponse.json({ error: 'This link is invalid or has been revoked.' }, { status: 404 })
  }

  // Verify the portfolio owner has a plan that allows sharing (Archive or beta)
  const { data: subRow } = await admin
    .from('subscriptions')
    .select('plan, is_beta')
    .eq('user_id', grant.owner_id)
    .single()

  const ownerPlan: Plan = subRow?.is_beta ? 'beta' : ((subRow?.plan as Plan) ?? 'preserve')
  if (!canSharePortfolio(ownerPlan)) {
    return NextResponse.json(
      { error: 'This portfolio is no longer publicly shared.' },
      { status: 403 },
    )
  }

  // Fetch artworks for the owner
  const { data: artworks } = await admin
    .from('artworks')
    .select('*')
    .eq('user_id', grant.owner_id)
    .order('uploaded_at', { ascending: false })

  // Fetch owner profile
  const { data: settings } = await admin
    .from('user_settings')
    .select('profile')
    .eq('user_id', grant.owner_id)
    .maybeSingle()

  // Record last accessed timestamp (fire-and-forget)
  admin
    .from('catalogue_access')
    .update({ last_accessed: new Date().toISOString() })
    .eq('token', token)
    .then(() => {})

  return NextResponse.json({
    artworks: artworks ?? [],
    profile: settings?.profile ?? {},
    granteeName: grant.grantee_name,
  })
}
