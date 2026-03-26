import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Public artwork access is not configured on this server.' },
      { status: 503 },
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

  const { data: row, error } = await admin
    .from('artworks')
    .select(
      'id, image_url, title, year, place, width, height, unit, material, ai_analysis, copyright_holder, copyright_year, is_public',
    )
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  return NextResponse.json(row)
}
