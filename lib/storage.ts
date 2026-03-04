import { Artwork } from './types'

const STORAGE_KEY = 'archive_artworks'

export function saveArtworks(artworks: Artwork[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(artworks))
  } catch (e) {
    console.warn('Failed to save artworks to localStorage', e)
  }
}

export function loadArtworks(): Artwork[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Artwork[]) : []
  } catch {
    return []
  }
}
