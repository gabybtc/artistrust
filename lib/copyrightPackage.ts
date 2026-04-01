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

/** Effective works per application (GRUW visual art = 10, GR2D published = 20, photos = 750) */
export function getBatchSize(workType: WorkType, publishedStatus: PublishedStatus): number {
  if (workType === '2d-visual-art') return publishedStatus === 'published' ? 20 : 10
  return BATCH_SIZE[workType]
}

/** Effective filing fee per application (GR2D published visual art = $85, all others = $55) */
export function getFilingFee(workType: WorkType, publishedStatus: PublishedStatus): number {
  if (workType === '2d-visual-art' && publishedStatus === 'published') return 85
  return FILING_FEE[workType]
}

/**
 * Convert an artwork title to a deposit image filename stem.
 * e.g. "Evening Light" → "Evening_Light", "Study No. 4" → "Study_No_4"
 */
export function titleToDepositName(title: string): string {
  return (
    title
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
  ) || 'Untitled'
}

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
  publishedStatus: PublishedStatus = 'unpublished',
): ApplicationGroup[] {
  const maxPerApp = getBatchSize(workType, publishedStatus)
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

// ─── Filename sanitiser ───────────────────────────────────────────────────────

/**
 * Strip trailing/leading spaces, collapse internal runs of spaces to a single
 * underscore, and remove characters that are problematic on most filesystems or
 * at the Copyright Office upload portal.
 */
export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')          // spaces → underscore
    .replace(/[^\w.\-]/g, '')      // keep word chars, dots, hyphens only
    .replace(/_{2,}/g, '_')        // collapse consecutive underscores
}

// ─── Medium simplifier ────────────────────────────────────────────────────────

/**
 * Produce a short, consistent medium string suitable for a copyright filing.
 * If the artist entered a material manually, use that directly.
 * Otherwise derive from the AI medium by taking only the text before any
 * parenthesis, " with ", " — ", or em-dash, then trim.
 */
export function simplifyCopyrightMedium(artwork: Artwork): string {
  const raw = artwork.material?.trim() || artwork.aiAnalysis?.medium?.trim() || ''
  if (!raw) return ''
  // If it came from the artist's own field it's usually already short — return as-is
  if (artwork.material?.trim()) return artwork.material.trim()
  // Strip verbose qualifiers from AI description
  return raw
    .split(/\s*[\(,]|\s+with\s|\s+—\s|—/)[0]
    .trim()
}

// ─── CSV Reference Template ───────────────────────────────────────────────────

function buildReferenceCsv(
  works: Array<{ artwork: Artwork; code: string }>,
  artistName: string,
  workType: WorkType,
  publishedStatus: PublishedStatus,
  date: string,
): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const appTypeLabel = publishedStatus === 'published'
    ? (workType === 'photographs' ? 'Published Photographs' : 'Published Two-Dimensional Artwork')
    : (workType === 'photographs' ? 'Unpublished Photographs' : 'Unpublished Two-Dimensional Artwork')

  // Header block (written as comment rows so it doesn't interfere with data columns)
  const headerBlock = [
    [`"ArtisTrust Copyright Export \u2014 Reference Template"`, '', '', '', '', ''],
    [escape(`Artist: ${artistName}`), '', '', '', '', ''],
    [escape(`Application type: ${appTypeLabel}`), '', '', '', '', ''],
    [`"Case #: _________________  (fill in after starting your application)"`, '', '', '', '', ''],
    [escape(`Total works: ${works.length}`), '', '', '', '', ''],
    [escape(`Date exported: ${date}`), '', '', '', '', ''],
    ['', '', '', '', '', ''],  // blank spacer row
  ].map(row => row.join(','))

  const columnHeaders = [
    'Code',
    'Original Title',
    'File Name',
    'Year',
    'Medium',
    'Published / Unpublished',
  ]

  const rows = works.map(({ artwork: a, code }) => {
    const title = a.title || a.aiAnalysis?.suggestedTitle || a.fileName || 'Untitled'
    const medium = simplifyCopyrightMedium(a)
    return [
      code,
      title,
      sanitizeFileName(a.fileName || ''),
      a.year || '',
      medium,
      publishedStatus === 'published' ? 'Published' : 'Unpublished',
    ].map(escape).join(',')
  })

  return [...headerBlock, columnHeaders.map(escape).join(','), ...rows].join('\r\n')
}

// ─── Visual art per-batch reference sheet ────────────────────────────────────

function buildVisualArtReferenceSheet(
  group: ApplicationGroup,
  filenameMap: Map<string, string>,  // code → full filename with ext e.g. "Evening_Light.jpg"
  artistName: string,
  publishedStatus: PublishedStatus,
  totalGroups: number,
  date: string,
): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const appTypeLabel = publishedStatus === 'published'
    ? 'Published Two-Dimensional Artwork'
    : 'Unpublished Two-Dimensional Artwork'

  const headerBlock = [
    [`"ArtisTrust Copyright Export \u2014 Reference Template"`, ''],
    [escape(`Artist: ${artistName}`), ''],
    [escape(`Application type: ${appTypeLabel} \u2014 Batch ${group.appIndex} of ${totalGroups}`), ''],
    [escape(`Works in this batch: ${group.works.length}`), ''],
    [escape(`Date exported: ${date}`), ''],
    ['', ''],
    [
      '"The title you copy and paste from the Reference sheet and the image file name will look slightly different \u2014 don\'t worry, this is correct."',
      '',
    ],
    [
      '"The Copyright Office requires spaces in titles and underscores in file names. They will match automatically in their system."',
      '',
    ],
    ['', ''],
    ['"Type this as the title"', '"Upload this file"'],
  ].map(row => row.join(','))

  const rows = group.works.map(({ artwork: a, code }) => {
    const title = a.title || a.aiAnalysis?.suggestedTitle || a.fileName?.replace(/\.[^.]+$/, '') || 'Untitled'
    const filename = filenameMap.get(code) ?? `${code}.jpg`
    return [escape(title), escape(filename)].join(',')
  })

  return [...headerBlock, ...rows].join('\r\n')
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

    Deposit_Images_Batch_X.zip  (or Deposit_Images.zip if one batch)
      Your deposit images renamed to their codes (e.g. RB001.jpg),
      packaged as a ZIP ready to drag and drop into the copyright.gov
      upload box. One ZIP per paste batch.

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
  Drag and drop Deposit_Images.zip (or Deposit_Images_Batch_1.zip) into
  the copyright.gov upload box for this batch.
  Repeat for each Deposit_Images_Batch_X.zip if there are multiple batches.
  Accepted formats inside the ZIP: JPEG, PNG, GIF, TIFF.
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

// ─── Visual art submission guide ─────────────────────────────────────────────

function buildVisualArtSubmissionGuide(
  artistName: string,
  publishedStatus: PublishedStatus,
  groups: ApplicationGroup[],
  totalWorks: number,
  date: string,
): string {
  const pubLabel = publishedStatus === 'published' ? 'Published' : 'Unpublished'
  const formType = publishedStatus === 'published'
    ? 'Group Registration of Two-Dimensional Artwork (GR2D) — Published'
    : 'Group Registration of Unpublished Works (GRUW) — Visual Art'
  const fee = getFilingFee('2d-visual-art', publishedStatus)
  const maxPerApp = getBatchSize('2d-visual-art', publishedStatus)
  const totalBatches = groups.length
  const totalFee = totalBatches * fee

  const batchSummary = groups.map(g =>
    `  Batch ${g.appIndex}: ${g.works.length} work${g.works.length === 1 ? '' : 's'}`
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
  Type of work:     Two-Dimensional Artwork
  Status:           ${pubLabel}
  Form type:        ${formType}
  Batches:          ${totalBatches}
  Fee per batch:    $${fee}
  Estimated total:  $${totalFee}

${batchSummary}

${'━'.repeat(64)}

WHAT'S IN THIS ZIP
──────────────────
  Submission_Guide.txt  ← you are reading this

  Batch_X/
    Reference_Sheet.csv
      Lists the ${maxPerApp} works in this batch. For each work it shows
      the exact title to enter in the form, the matching image filename,
      year and medium.

      NOTE: The title (e.g. "Evening Light") and the filename
      (e.g. "Evening_Light.jpg") will look slightly different —
      this is correct. The Copyright Office requires spaces in titles
      and underscores in file names. They match automatically.

    Deposit_Images.zip
      Image files named with underscores to match their titles
      (e.g. Evening_Light.jpg). Drag and drop directly into the
      copyright.gov upload box when prompted for deposit copies.

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
  Write it down — you will need it if you check filing status later.

STEP 4 — Complete author and claimant fields
  Author:    ${artistName}
  Claimant:  ${artistName} (unless you have transferred rights)
  Rights and Permissions: your studio or personal email address

STEP 5 — Add titles (one per work)
  Open Reference_Sheet.csv for Batch 1.
  On the Titles screen, add each title individually, exactly as shown
  in the "Type this as the title" column.
  Do not add underscores — copy the title text exactly as written.

STEP 6 — Upload deposit images
  When prompted for deposit images, drag and drop Deposit_Images.zip
  from Batch 1 directly into the upload box.
  The system matches filenames to titles automatically.
${totalBatches > 1 ? `
STEP 7 — Additional batches
  Each batch is a separate $${fee} application. Repeat Steps 2–6
  for each Batch_X folder. Open a fresh application for each one.
` : ''}
STEP ${totalBatches > 1 ? '8' : '7'} — Pay and submit
  Fee: $${fee} per application × ${totalBatches} = $${totalFee} total.
  Pay by credit/debit card or Copyright Office deposit account.
  You will receive a confirmation email with your Service Request Number.
  Processing typically takes 3–8 months for online filings.

STEP ${totalBatches > 1 ? '9' : '8'} — Receive your certificate
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
  //    Photographs → sequential prefix codes (RB001, RB002, …)
  //    Visual art  → title-based stems (Evening_Light, Study_No_4, …)
  let codes: string[]
  if (workType === '2d-visual-art') {
    const seen = new Map<string, number>()
    codes = artworks.map(a => {
      const title = a.title || a.aiAnalysis?.suggestedTitle || a.fileName?.replace(/\.[^.]+$/, '') || 'Untitled'
      const base = titleToDepositName(title)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      return count === 0 ? base : `${base}_${count + 1}`
    })
  } else {
    codes = generateCodes(prefix, artworks.length)
  }

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
  const groups = buildApplicationGroups(artworks, codes, workType, imageSizes, publishedStatus)

  // 4. Build zip
  const root = new JSZip()

  // Submission guide at root (different text for photos vs visual art)
  root.file('Submission_Guide.txt',
    workType === '2d-visual-art'
      ? buildVisualArtSubmissionGuide(artistName, publishedStatus, groups, artworks.length, date)
      : buildSubmissionGuide(artistName, workType, publishedStatus, groups, artworks.length, date),
  )

  if (workType === '2d-visual-art') {
    // ── Visual art: one Batch_X folder per group of 10 (or 20 published) works ──
    // Each folder contains a Reference_Sheet.csv and a Deposit_Images.zip.
    // No paste batches — the artist types each title individually into eCO.
    for (const group of groups) {
      const batchFolder = root.folder(`Batch_${group.appIndex}`)!

      // Build code → "filename.ext" map for this batch (extension known after fetch)
      const filenameMap = new Map<string, string>()
      for (const { artwork, code } of group.works) {
        const result = fetched.get(artwork.id)
        const ext = result?.blob ? result.ext : 'jpg'
        filenameMap.set(code, `${code}.${ext}`)
      }

      // Per-batch reference sheet showing title ↔ filename side by side
      batchFolder.file(
        'Reference_Sheet.csv',
        buildVisualArtReferenceSheet(group, filenameMap, artistName, publishedStatus, groups.length, date),
      )

      // Image ZIP — drag and drop into copyright.gov upload box
      const batchZip = new JSZip()
      for (const { artwork, code } of group.works) {
        const result = fetched.get(artwork.id)
        if (!result?.blob) continue
        batchZip.file(filenameMap.get(code)!, result.blob)
      }
      const batchZipBlob = await batchZip.generateAsync({ type: 'blob' })
      batchFolder.file('Deposit_Images.zip', batchZipBlob)
    }

  } else {
    // ── Photographs: root reference CSV + per-application paste batches + image ZIPs ──
    const allWorks = groups.flatMap(g => g.works)
    root.file('Reference_Template.csv', buildReferenceCsv(allWorks, artistName, workType, publishedStatus, date))

    for (const group of groups) {
      const appFolder = root.folder(`Application_${group.appIndex}`)!
      const totalBatches = group.pasteBatches.length

      // Build code → fetch result lookup
      const codeToFetch = new Map<string, FetchResult>()
      for (const { artwork, code } of group.works) {
        const result = fetched.get(artwork.id)
        if (result) codeToFetch.set(code, result)
      }

      for (let bi = 0; bi < totalBatches; bi++) {
        const batch = group.pasteBatches[bi]
        const batchNum = bi + 1

        // Paste text file
        const txtFilename = totalBatches === 1 ? 'Paste_String.txt' : `Paste_Batch_${batchNum}.txt`
        appFolder.file(txtFilename, buildPasteFile(batch, group.appIndex, batchNum, totalBatches))

        // Image ZIP for this batch — drag and drop into copyright.gov upload box
        const batchZip = new JSZip()
        for (const code of batch) {
          const result = codeToFetch.get(code)
          if (!result?.blob) continue
          batchZip.file(`${code}.${result.ext}`, result.blob)
        }
        const zipFilename = totalBatches === 1 ? 'Deposit_Images.zip' : `Deposit_Images_Batch_${batchNum}.zip`
        const batchZipBlob = await batchZip.generateAsync({ type: 'blob' })
        appFolder.file(zipFilename, batchZipBlob)
      }
    }
  }

  return root.generateAsync({
    type: 'blob',
    comment: `ArtisTrust copyright export for ${artistName} — ${date}`,
  })
}
