// ── Plan types ────────────────────────────────────────────────────────────────

export type Plan = 'preserve' | 'studio' | 'archive' | 'beta'
export type BillingInterval = 'monthly' | 'annual'

// ── Monthly upload limits ─────────────────────────────────────────────────────
// null = unlimited (beta). Overage uploads cost OVERAGE_COST_USD each.

export const MONTHLY_UPLOAD_LIMITS: Record<Plan, number | null> = {
  preserve: 25,
  studio:   100,
  archive:  250,
  beta:     null,
}

/** Cost in USD charged per upload that exceeds the monthly plan limit */
export const OVERAGE_COST_USD = 0.05

/** Stripe's minimum charge amount — batches smaller than this are rounded up */
export const OVERAGE_MIN_CHARGE_USD = 0.50

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
      { label: '25 uploads / month',              included: true  },
      { label: 'AI analysis on every upload',     included: true  },
      { label: 'Voice memos',                     included: true  },
      { label: 'Full archive export at any time', included: true  },
      { label: 'Film archive metadata',           included: false },
      { label: 'Copyright export package',        included: false },
      { label: 'Shareable portfolio',             included: false },
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
      { label: '100 uploads / month',             included: true  },
      { label: 'AI analysis on every upload',     included: true  },
      { label: 'Voice memos – artist\'s story',   included: true  },
      { label: 'Film archive metadata',           included: true  },
      { label: 'Copyright export package',        included: true  },
      { label: 'Full archive export at any time', included: true  },
      { label: 'Shareable portfolio',             included: false },
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
      { label: '250 uploads / month',             included: true  },
      { label: 'AI analysis on every upload',     included: true  },
      { label: 'Voice memos – artist\'s story',   included: true  },
      { label: 'Film archive metadata',           included: true  },
      { label: 'Shareable public portfolio',      included: true  },
      { label: 'PDF catalog export',              included: true  },
      { label: 'Copyright export package',        included: true  },
      { label: 'Full archive export at any time', included: true  },
      { label: 'Dedicated archivist support',     included: true  },
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

/** Monthly upload limit for a plan (null = unlimited). */
export function getMonthlyUploadLimit(plan: Plan): number | null {
  return MONTHLY_UPLOAD_LIMITS[plan]
}

/**
 * Whether the user is within their free monthly upload allowance.
 * monthlyCount = number of artworks uploaded so far this calendar month.
 */
export function canUploadMore(plan: Plan, monthlyCount: number): boolean {
  const limit = MONTHLY_UPLOAD_LIMITS[plan]
  if (limit === null) return true
  return monthlyCount < limit
}

/** Free uploads remaining this month (null = unlimited). */
export function monthlyUploadsRemaining(plan: Plan, monthlyCount: number): number | null {
  const limit = MONTHLY_UPLOAD_LIMITS[plan]
  if (limit === null) return null
  return Math.max(0, limit - monthlyCount)
}

/** Whether the user can use copyright export package. */
export function canExportCopyright(plan: Plan): boolean {
  return plan === 'studio' || plan === 'archive' || plan === 'beta'
}

/** Whether the user can view/use EXIF film archive metadata. */
export function canViewExif(plan: Plan): boolean {
  return plan === 'studio' || plan === 'archive' || plan === 'beta'
}

/** Whether the user can share individual public work pages (Studio+). */
export function canShareWork(plan: Plan): boolean {
  return plan === 'studio' || plan === 'archive' || plan === 'beta'
}

/** Whether the user can create shareable portfolio links (Archive+). */
export function canSharePortfolio(plan: Plan): boolean {
  return plan === 'archive' || plan === 'beta'
}

/** Whether the user can export a PDF catalogue. */
export function canExportPdf(plan: Plan): boolean {
  return plan === 'archive' || plan === 'beta'
}

/** Human-readable display label for the plan, used in badges etc. */
export function planLabel(plan: Plan): string {
  return PLAN_CONFIG[plan].label
}
