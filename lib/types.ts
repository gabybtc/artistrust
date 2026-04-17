export type { ExifData } from './extractExif'

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
  mediaType: string
  status: 'uploading' | 'analyzing' | 'ready' | 'complete'
  uploadedAt: string
  aiAnalysis?: AiAnalysis
  voiceMemo?: string
  series?: string
  exifData?: import('./extractExif').ExifData
  tags?: string[]
  // Copyright
  copyrightStatus: 'automatic' | 'registered'
  copyrightHolder: string   // defaults to artist name
  copyrightYear: string     // defaults to year of creation
  copyrightRegNumber: string // registration number if registered
  isPublic?: boolean        // whether this artwork has a public share page
  editions?: string          // number of editions (photography)
}

/** A user-defined catalogue tab (category) */
export interface Tab {
  id: string      // slug-like unique key, e.g. "painting", "street-photography"
  label: string   // display name, e.g. "Paintings", "Street Photography"
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
  emailVerified?: boolean
}

/**
 * Sticky defaults applied to every newly queued artwork.
 * Users set these once in the UploadDefaultsBar so they don't have to re-enter
 * the same artist name, location, or medium for every piece.
 */
export type UploadDefaults = Partial<Pick<Artwork,
  'copyrightHolder' | 'location' | 'material' | 'year' | 'series' | 'place'
>>

/** A shared-access grant — allows a named person to view the catalogue via a private link */
export interface AccessGrant {
  id: string
  token: string
  granteeName: string
  granteeEmail: string
  createdAt: string
  lastAccessed: string | null
}

/** The user's active subscription record, mirroring the subscriptions table. */
export interface UserSubscription {
  userId: string
  plan: import('./plans').Plan
  billingInterval: import('./plans').BillingInterval | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  isBeta: boolean
  createdAt: string
  updatedAt: string
}
