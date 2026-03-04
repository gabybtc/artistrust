import { supabase } from './supabase'
import type { Artwork, LegalSettings } from './types'

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
  const syncable = artworks.filter(a => !a.imageData.startsWith('data:'))
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
