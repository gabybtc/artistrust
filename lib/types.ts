export interface AiAnalysis {
  style?: string
  medium?: string
  subject?: string
  description?: string
  colorPalette?: string[]
  suggestedTitle?: string
}

export interface Artwork {
  id: string
  imageData: string
  fileName: string
  title: string
  year: string
  place: string
  location: string       // physical storage location (vault, studio, home, etc.)
  width: string
  height: string
  unit: 'cm' | 'in'
  material: string
  mediaType: 'painting' | 'photography'
  status: 'uploading' | 'analyzing' | 'ready' | 'complete'
  uploadedAt: string
  aiAnalysis?: AiAnalysis
  voiceMemo?: string
  // Copyright
  copyrightStatus: 'automatic' | 'registered'
  copyrightHolder: string   // defaults to artist name
  copyrightYear: string     // defaults to year of creation
  copyrightRegNumber: string // registration number if registered
}

/** Account-level legal designee settings — one record per user */
export interface LegalSettings {
  designeeName: string
  designeeEmail: string
  designeeRelationship: string
  designeePhone: string
  attorneyName: string
  attorneyContact: string
  notes: string
}

/** Artist profile — stored in user_settings.profile */
export interface ProfileSettings {
  fullName: string
  studioName: string
  website: string
  bio: string
}

/** A shared-access grant — allows a named person to view the catalogue via a private link */
export interface AccessGrant {
  id: string
  token: string
  granteeName: string
  granteeEmail: string
  createdAt: string
  lastAccessed: string | null
}
