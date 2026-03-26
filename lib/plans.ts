// ── Plan types ────────────────────────────────────────────────────────────────

export type Plan = 'preserve' | 'studio' | 'archive' | 'beta'
export type BillingInterval = 'monthly' | 'annual'

// ── Preserve work limit ───────────────────────────────────────────────────────

export const PRESERVE_WORK_LIMIT = 50

// ── Stripe price IDs (set in env) ────────────────────────────────────────────
// NEXT_PUBLIC_ prefix so they are safely readable on the client for checkout.

export const STRIPE_PRICES = {
  studio_monthly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY  ?? '',
  studio_annual:   process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_ANNUAL   ?? '',
  archive_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ARCHIVE_MONTHLY ?? '',
  archive_annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_ARCHIVE_ANNUAL  ?? '',
} as const

// ── Plan display config ───────────────────────────────────────────────────────

export const PLAN_CONFIG = {
  preserve: {
    label: 'Preserve',
    tier: 'Tier One',
    tagline: 'For getting started and falling in love with it.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    features: [
      { label: 'Up to 50 works',              included: true  },
      { label: 'AI analysis on every upload', included: true  },
      { label: 'Voice memos',                 included: true  },
      { label: 'Full archive export at any time', included: true  },
      { label: 'Unlimited works',             included: false },
      { label: 'Film archive metadata',       included: false },
      { label: 'Copyright export package',    included: false },
    ],
  },
  studio: {
    label: 'Studio',
    tier: 'Tier Two',
    tagline: 'For artists serious about their archive.',
    monthlyPrice: 8,
    annualMonthlyPrice: 6,
    annualTotal: 77,
    mostPopular: true,
    features: [
      { label: 'Unlimited works',                included: true  },
      { label: 'AI analysis on every upload',    included: true  },
      { label: 'Voice memos – artist\'s story',  included: true  },
      { label: 'Film archive metadata',          included: true  },
      { label: 'Full archive export at any time',included: true  },
      { label: 'Copyright export package',       included: true  },
      { label: 'Shareable portfolio',            included: false },
    ],
  },
  archive: {
    label: 'Archive',
    tier: 'Tier Three',
    tagline: 'For established practitioners who want to share.',
    monthlyPrice: 15,
    annualMonthlyPrice: 12,
    annualTotal: 144,
    features: [
      { label: 'Unlimited works',                included: true  },
      { label: 'AI analysis on every upload',    included: true  },
      { label: 'Voice memos – artist\'s story',  included: true  },
      { label: 'Film archive metadata',          included: true  },
      { label: 'Shareable public portfolio',     included: true  },
      { label: 'PDF catalogue export',           included: true  },
      { label: 'Full archive export at any time',included: true  },
      { label: 'Copyright export package',       included: true  },
      { label: 'Annual plan: free legacy upload',included: true  },
      { label: 'Dedicated archivist support',    included: true  },
    ],
  },
  beta: {
    label: 'Beta',
    tier: 'Beta',
    tagline: 'Early access — all features unlocked.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    features: [],
  },
} as const

// ── Permission helpers ────────────────────────────────────────────────────────
// All functions accept a Plan and are pure — no async, no DB calls.

/** Whether the user can upload another artwork given their current work count. */
export function canUploadMore(plan: Plan, currentCount: number): boolean {
  if (plan === 'preserve') return currentCount < PRESERVE_WORK_LIMIT
  return true // studio, archive, beta all have unlimited uploads
}

/** Whether the user can use copyright export package. */
export function canExportCopyright(plan: Plan): boolean {
  return plan === 'studio' || plan === 'archive' || plan === 'beta'
}

/** Whether the user can view/use EXIF film archive metadata. */
export function canViewExif(plan: Plan): boolean {
  return plan === 'studio' || plan === 'archive' || plan === 'beta'
}

/** Whether the user can create shareable portfolio links. */
export function canSharePortfolio(plan: Plan): boolean {
  return plan === 'archive' || plan === 'beta'
}

/** Whether the user can export a PDF catalogue. */
export function canExportPdf(plan: Plan): boolean {
  return plan === 'archive' || plan === 'beta'
}

/** Whether the user gets a free legacy upload (annual Studio/Archive or beta). */
export function hasFreeLegacyUpload(plan: Plan, interval: BillingInterval | null): boolean {
  if (plan === 'beta') return true
  if ((plan === 'studio' || plan === 'archive') && interval === 'annual') return true
  return false
}

/**
 * Returns the one-time legacy upload fee in cents for a given work count.
 * Returns 0 if the user is entitled to a free legacy upload.
 *
 * Tiers (matching the website):
 *   1–50 works:   free
 *   51–200 works: $15
 *   201–500 works: $29
 *   501+ works:   $0.10/work (returned as total cents)
 */
export function getLegacyUploadFee(
  workCount: number,
  plan: Plan,
  interval: BillingInterval | null,
): { cents: number; tier: string } {
  if (hasFreeLegacyUpload(plan, interval) || workCount <= 50) {
    return { cents: 0, tier: '1-50' }
  }
  if (workCount <= 200) return { cents: 1500, tier: '51-200' }
  if (workCount <= 500) return { cents: 2900, tier: '201-500' }
  return { cents: workCount * 10, tier: '501+' }
}

/** Human-readable display label for the plan, used in badges etc. */
export function planLabel(plan: Plan): string {
  return PLAN_CONFIG[plan].label
}
