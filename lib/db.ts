import { supabase } from './supabase'
import type { Artwork, LegalSettings, ProfileSettings, AccessGrant } from './types'

// ── Row shape (matches the Supabase artworks table) ───────────────────────────
interface ArtworkRow {
  id: string
  user_id: string
  image_url: string
  file_name: string
  title: string
  year: string
  place: string
  location: string
  width: string
  height: string
  unit: string
  material: string
  media_type: string
  status: string
  uploaded_at: string
  ai_analysis: Artwork['aiAnalysis'] | null
  voice_memo: string | null
  copyright_status: string
  copyright_holder: string
  copyright_year: string
  copyright_reg_number: string
}

// ── Serialisation helpers ─────────────────────────────────────────────────────
function toRow(artwork: Artwork, userId: string): ArtworkRow {
  return {
    id: artwork.id,
    user_id: userId,
    image_url: artwork.imageData,
    file_name: artwork.fileName,
    title: artwork.title,
    year: artwork.year,
    place: artwork.place,
    location: artwork.location,
    width: artwork.width,
    height: artwork.height,
    unit: artwork.unit,
    material: artwork.material,
    media_type: artwork.mediaType,
    status: artwork.status,
    uploaded_at: artwork.uploadedAt,
    ai_analysis: artwork.aiAnalysis ?? null,
    voice_memo: artwork.voiceMemo ?? null,
    copyright_status: artwork.copyrightStatus,
    copyright_holder: artwork.copyrightHolder,
    copyright_year: artwork.copyrightYear,
    copyright_reg_number: artwork.copyrightRegNumber,
  }
}

function fromRow(row: ArtworkRow): Artwork {
  return {
    id: row.id,
    imageData: row.image_url,
    fileName: row.file_name,
    title: row.title,
    year: row.year,
    place: row.place,
    location: row.location ?? '',
    width: row.width,
    height: row.height,
    unit: row.unit as 'cm' | 'in',
    material: row.material,
    mediaType: (row.media_type as Artwork['mediaType']) || 'painting',
    status: row.status as Artwork['status'],
    uploadedAt: row.uploaded_at,
    aiAnalysis: row.ai_analysis ?? undefined,
    voiceMemo: row.voice_memo ?? undefined,
    copyrightStatus: (row.copyright_status as Artwork['copyrightStatus']) || 'automatic',
    copyrightHolder: row.copyright_holder ?? '',
    copyrightYear: row.copyright_year ?? '',
    copyrightRegNumber: row.copyright_reg_number ?? '',
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function fetchArtworks(userId: string): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })

  if (error) { console.error('fetchArtworks:', error); return [] }
  return (data as ArtworkRow[]).map(fromRow)
}

/** Insert or update a single artwork. Only call once imageData is a URL (not base64). */
export async function upsertArtwork(artwork: Artwork, userId: string): Promise<void> {
  const { error } = await supabase
    .from('artworks')
    .upsert(toRow(artwork, userId), { onConflict: 'id' })

  if (error) console.error('upsertArtwork:', error)
}

/** Bulk upsert — used by the debounced sync effect. Skips artworks still in base64. */
export async function upsertArtworks(artworks: Artwork[], userId: string): Promise<void> {
  // Exclude artworks still using a base64 data URL or a temporary blob URL —
  // both indicate the storage upload hasn't finished yet.
  const syncable = artworks.filter(a =>
    !a.imageData.startsWith('data:') && !a.imageData.startsWith('blob:')
  )
  if (!syncable.length) return

  const { error } = await supabase
    .from('artworks')
    .upsert(syncable.map(a => toRow(a, userId)), { onConflict: 'id' })

  if (error) console.error('upsertArtworks:', error)
}

export async function deleteArtworkFromDB(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('artworks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) console.error('deleteArtworkFromDB:', error)
}

// ── Legal settings (one row per user) ────────────────────────────────────────

export async function getLegalSettings(userId: string): Promise<LegalSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('legal')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return (data.legal as LegalSettings) ?? null
}

export async function saveLegalSettings(userId: string, legal: LegalSettings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, legal }, { onConflict: 'user_id' })

  if (error) console.error('saveLegalSettings:', error)
}

// ── Profile settings (one row per user) ──────────────────────────────────────

export async function getProfileSettings(userId: string): Promise<ProfileSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('profile')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return (data.profile as ProfileSettings) ?? null
}

export async function saveProfileSettings(userId: string, profile: ProfileSettings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, profile }, { onConflict: 'user_id' })

  if (error) console.error('saveProfileSettings:', error)
}

// ── Catalogue access grants ───────────────────────────────────────────────────

export async function getAccessGrants(userId: string): Promise<AccessGrant[]> {
  const { data, error } = await supabase
    .from('catalogue_access')
    .select('id, token, grantee_name, grantee_email, created_at, last_accessed')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(r => ({
    id: r.id,
    token: r.token,
    granteeName: r.grantee_name,
    granteeEmail: r.grantee_email,
    createdAt: r.created_at,
    lastAccessed: r.last_accessed,
  }))
}

export async function createAccessGrant(
  userId: string,
  granteeName: string,
  granteeEmail: string,
): Promise<AccessGrant | null> {
  const { data, error } = await supabase
    .from('catalogue_access')
    .insert({ owner_id: userId, grantee_name: granteeName, grantee_email: granteeEmail })
    .select('id, token, grantee_name, grantee_email, created_at, last_accessed')
    .single()

  if (error || !data) { console.error('createAccessGrant:', error); return null }
  return {
    id: data.id,
    token: data.token,
    granteeName: data.grantee_name,
    granteeEmail: data.grantee_email,
    createdAt: data.created_at,
    lastAccessed: data.last_accessed,
  }
}

export async function revokeAccessGrant(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('catalogue_access')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)

  if (error) console.error('revokeAccessGrant:', error)
}
