import JSZip from 'jszip'
import type { Artwork } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters the eCO Photograph Titles field accepts */
const ECO_CHAR_LIMIT = 1995

/** Max uncompressed image bytes per batch upload to copyright.gov */
const BATCH_BYTE_LIMIT = 500 * 1024 * 1024 // 500 MB

/** Works per application by type */
export const BATCH_SIZE: Record<WorkType, number> = {
  photographs: 750,
  '2d-visual-art': 20,
}

/** Filing fee per application (USD) */
export const FILING_FEE: Record<WorkType, number> = {
  photographs: 55,
  '2d-visual-art': 55,
}

export type WorkType = 'photographs' | '2d-visual-art'
export type PublishedStatus = 'unpublished' | 'published'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive initials from a full name, e.g. "Ricardo Betancourt" → "RB" */
export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 4) // max 4 chars to keep codes short
}

/** Generate sequential codes: RB001, RB002, … */
export function generateCodes(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(3, '0')}`)
}

/**
 * Split an array of codes into paste batches that each fit within
 * ECO_CHAR_LIMIT. Returns array of string arrays.
 */
export function splitIntoPasteBatches(codes: string[]): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let charCount = 0
  for (const code of codes) {
    const addLen = current.length === 0 ? code.length : code.length + 2 // ", "
    if (charCount + addLen > ECO_CHAR_LIMIT && current.length > 0) {
      batches.push(current)
      current = [code]
      charCount = code.length
    } else {
      current.push(code)
      charCount += addLen
    }
  }
  if (current.length > 0) batches.push(current)
  return batches
}

/**
 * Group works into applications respecting BATCH_SIZE, then further split
 * each application's codes into paste batches. Also splits by byte size.
 */
export interface ApplicationGroup {
  appIndex: number            // 1-based
  works: Array<{ artwork: Artwork; code: string }>
  pasteBatches: string[][]    // each is a list of codes fitting ECO_CHAR_LIMIT
}

export function buildApplicationGroups(
  artworks: Artwork[],
  codes: string[],
  workType: WorkType,
  imageSizes: Map<string, number>,  // artwork.id → byte size (0 if unknown)
): ApplicationGroup[] {
  const maxPerApp = BATCH_SIZE[workType]
  const groups: ApplicationGroup[] = []
  let i = 0
  let appIndex = 1

  while (i < artworks.length) {
    const appWorks: Array<{ artwork: Artwork; code: string }> = []
    let byteAccum = 0
    let j = i

    while (j < artworks.length && appWorks.length < maxPerApp) {
      const bytes = imageSizes.get(artworks[j].id) ?? 0
      // If adding would bust 500 MB and we already have some, start a new app
      if (appWorks.length > 0 && byteAccum + bytes > BATCH_BYTE_LIMIT) break
      appWorks.push({ artwork: artworks[j], code: codes[j] })
      byteAccum += bytes
      j++
    }

    const appCodes = appWorks.map(w => w.code)
    groups.push({
      appIndex,
      works: appWorks,
      pasteBatches: splitIntoPasteBatches(appCodes),
    })
    i = j
    appIndex++
  }
  return groups
}

// ─── CSV Reference Template ───────────────────────────────────────────────────

function buildReferenceCsv(
  works: Array<{ artwork: Artwork; code: string }>,
  publishedStatus: PublishedStatus,
): string {
  const headers = [
    'Code',
    'Original Title',
    'File Name',
    'Year',
    'Medium',
    'Published / Unpublished',
    'Case Number (fill in after starting application)',
  ]
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = works.map(({ artwork: a, code }) => {
    const title = a.title || a.aiAnalysis?.suggestedTitle || a.fileName || 'Untitled'
    const medium = a.material || a.aiAnalysis?.medium || ''
    return [
      code,
      title,
      a.fileName || '',
      a.year || '',
      medium,
      publishedStatus === 'published' ? 'Published' : 'Unpublished',
      '',
    ].map(escape).join(',')
  })
  return [headers.map(escape).join(','), ...rows].join('\r\n')
}

// ─── Paste-string text file ───────────────────────────────────────────────────

function buildPasteFile(
  codes: string[],
  appIndex: number,
  batchIndex: number,
  totalBatches: number,
): string {
  const pasteString = codes.join(', ')
  return `ArtisTrust Copyright Export
Application ${appIndex} · Paste Batch ${batchIndex} of ${totalBatches}
${'─'.repeat(72)}

Number to select from dropdown: ${codes.length}

Copy everything between the double-dashed lines and paste into the
"Photograph Titles" field on the Titles screen of the eCO application.

${'══'.repeat(36)}
${pasteString}
${'══'.repeat(36)}

Character count: ${pasteString.length} / ${1995}
`
}

// ─── Submission guide (plain text) ───────────────────────────────────────────

function buildSubmissionGuide(
  artistName: string,
  workType: WorkType,
  publishedStatus: PublishedStatus,
  groups: ApplicationGroup[],
  totalWorks: number,
  date: string,
): string {
  const typeLabel = workType === 'photographs' ? 'Photographs' : 'Two-Dimensional Artwork'
  const pubLabel = publishedStatus === 'published' ? 'Published' : 'Unpublished'
  const formType = workType === 'photographs'
    ? (publishedStatus === 'published' ? 'Group Registration of Published Photographs (GRPPH)' : 'Group Registration of Unpublished Photographs (GRUPH)')
    : (publishedStatus === 'published' ? 'Standard VA Application (published)' : 'Group Registration of Unpublished Works (GRUW) — Visual Art')
  const totalApps = groups.length
  const fee = FILING_FEE[workType]
  const totalFee = totalApps * fee

  const appSummary = groups.map(g =>
    `  Application ${g.appIndex}: ${g.works.length} work${g.works.length === 1 ? '' : 's'}, ${g.pasteBatches.length} paste batch${g.pasteBatches.length === 1 ? '' : 'es'}`
  ).join('\n')

  return `ARTISTRUST — COPYRIGHT SUBMISSION GUIDE
For: ${artistName}
Generated: ${date}
${'━'.repeat(64)}

DISCLAIMER
──────────
This guide is for informational purposes only and does not constitute
legal advice. ArtisTrust does not submit to copyright.gov on your
behalf and is not responsible for the outcome of any filing.
For complex situations, consult a copyright attorney.

${'━'.repeat(64)}

PACKAGE SUMMARY
───────────────
  Works included:   ${totalWorks}
  Type of work:     ${typeLabel}
  Status:           ${pubLabel}
  Form type:        ${formType}
  Applications:     ${totalApps}
  Fee per app:      $${fee}
  Estimated total:  $${totalFee}

${appSummary}

${'━'.repeat(64)}

WHAT'S IN THIS ZIP
──────────────────
  Reference_Template.csv
    One row per work. Contains your code, title, file name, year and
    medium. The Case Number column is blank — fill it in after you start
    your application at copyright.gov.

  Application_X/
    Paste_Batch_X.txt
      The comma-separated code string to paste into eCO. Each file
      contains a batch pre-calculated to stay within the 1,995-character
      limit. The number to select from the dropdown is labelled clearly.

    Images/
      Your deposit images renamed to their codes (e.g. RB001.jpg).
      Upload this folder's contents as your deposit copies.

${'━'.repeat(64)}

STEP-BY-STEP INSTRUCTIONS
──────────────────────────

STEP 1 — Create an account
  Go to: https://eco.copyright.gov
  Click "If you are a new user, click here to register."

STEP 2 — Start a new application
  Log in and click "Register a New Claim."
  Select: ${formType}

STEP 3 — Note your Case Number
  The system assigns a Case Number as soon as you start.
  Copy it into the Reference_Template.csv now — you will need it
  if you ever need to check the status of your filing.

STEP 4 — Complete author and claimant fields
  Author:    ${artistName}
  Claimant:  ${artistName} (unless you have transferred rights)
  Rights and Permissions: your studio or personal email address

STEP 5 — Titles screen (paste your codes)
  Click "New" on the Titles screen.
  Open Paste_Batch_1.txt and paste the entire code string into the
  Photograph Titles field.
  Select the count shown ("Number to select from dropdown") and click Save.
${totalApps > 1 || groups.some(g => g.pasteBatches.length > 1) ? `  Repeat for each Paste_Batch file within this application.\n` : ''}
STEP 6 — Upload deposit images
  Upload the contents of the Images/ folder for Application 1.
  Accepted formats: JPEG, PNG, GIF, TIFF.
${totalApps > 1 ? `
STEP 7 — Additional applications
  If you have more than one Application folder, start a new application
  for each one and repeat Steps 2–6. Each is a separate $${fee} fee.
` : ''}
STEP ${totalApps > 1 ? '8' : '7'} — Pay and submit
  Fee: $${fee} per application × ${totalApps} = $${totalFee} total.
  Pay by credit/debit card or Copyright Office deposit account.
  You will receive a confirmation email with your Service Request Number.
  Processing typically takes 3–8 months for online filings.

STEP ${totalApps > 1 ? '9' : '8'} — Receive your certificate
  The Copyright Office mails an official Certificate of Registration.
  Store it safely — it is your legal proof of ownership.
  Enter the registration number in each artwork's record in ArtisTrust.

${'━'.repeat(64)}

USEFUL LINKS
────────────
  eCO system:           https://eco.copyright.gov
  Help center:          https://www.copyright.gov/help/
  Copyright Office tel: 1-877-476-0778
`
}

// ─── Main export function ─────────────────────────────────────────────────────

export interface GeneratePackageOptions {
  artworks: Artwork[]
  artistName: string
  prefix: string           // e.g. "RB"
  workType: WorkType
  publishedStatus: PublishedStatus
}

export async function generateCopyrightPackage(
  options: GeneratePackageOptions,
): Promise<Blob> {
  const { artworks, artistName, prefix, workType, publishedStatus } = options
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // 1. Generate codes
  const codes = generateCodes(prefix, artworks.length)

  // 2. Fetch images + measure sizes
  type FetchResult = { id: string; blob: Blob | null; ext: string }
  const fetched = new Map<string, FetchResult>()
  const imageSizes = new Map<string, number>()

  await Promise.all(artworks.map(async (a) => {
    if (!a.imageData.startsWith('http')) {
      fetched.set(a.id, { id: a.id, blob: null, ext: 'jpg' })
      imageSizes.set(a.id, 0)
      return
    }
    try {
      const res = await fetch(a.imageData)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg'
      fetched.set(a.id, { id: a.id, blob, ext })
      imageSizes.set(a.id, blob.size)
    } catch {
      fetched.set(a.id, { id: a.id, blob: null, ext: 'jpg' })
      imageSizes.set(a.id, 0)
    }
  }))

  // 3. Build application groups (respects batch size + 500 MB image limit)
  const groups = buildApplicationGroups(artworks, codes, workType, imageSizes)

  // 4. Assemble all works with codes in order for the reference CSV
  const allWorks = groups.flatMap(g => g.works)

  // 5. Build zip
  const root = new JSZip()

  // Reference CSV at root
  root.file('Reference_Template.csv', buildReferenceCsv(allWorks, publishedStatus))

  // Submission guide at root
  root.file('Submission_Guide.txt', buildSubmissionGuide(
    artistName, workType, publishedStatus, groups, artworks.length, date,
  ))

  // One folder per application
  for (const group of groups) {
    const appLabel = `Application_${group.appIndex}`
    const appFolder = root.folder(appLabel)!
    const imagesFolder = appFolder.folder('Images')!

    // Paste batch files
    for (let bi = 0; bi < group.pasteBatches.length; bi++) {
      const batch = group.pasteBatches[bi]
      const filename = group.pasteBatches.length === 1
        ? 'Paste_String.txt'
        : `Paste_Batch_${bi + 1}.txt`
      appFolder.file(filename, buildPasteFile(batch, group.appIndex, bi + 1, group.pasteBatches.length))
    }

    // Images
    for (const { artwork, code } of group.works) {
      const result = fetched.get(artwork.id)
      if (!result?.blob) continue
      imagesFolder.file(`${code}.${result.ext}`, result.blob)
    }
  }

  return root.generateAsync({
    type: 'blob',
    comment: `ArtisTrust copyright export for ${artistName} — ${date}`,
  })
}
