import JSZip from 'jszip'
import type { Artwork } from './types'

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled'
}

function buildCsv(artworks: Artwork[]): string {
  const headers = [
    'Title',
    'Year Created',
    'Medium',
    'Width',
    'Height',
    'Unit',
    'Copyright Holder',
    'Copyright Year',
    'Registration Number',
  ]

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const rows = artworks.map(a => {
    const title = a.title || a.aiAnalysis?.suggestedTitle || 'Untitled'
    const medium = a.material || a.aiAnalysis?.medium || ''
    return [
      title,
      a.year,
      medium,
      a.width,
      a.height,
      a.unit,
      a.copyrightHolder,
      a.copyrightYear || a.year,
      a.copyrightRegNumber,
    ].map(escape).join(',')
  })

  return [headers.map(escape).join(','), ...rows].join('\r\n')
}

function buildGuide(artistName: string, artworkCount: number): string {
  return `COPYRIGHT REGISTRATION GUIDE
For: ${artistName}
Package contains: ${artworkCount} artwork${artworkCount === 1 ? '' : 's'}
Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY COPYRIGHT YOUR WORK?
────────────────────────
Registering your work with the U.S. Copyright Office gives you the
legal right to sue for statutory damages (up to $150,000 per work for
willful infringement) and attorney's fees — rights you lose if you only
rely on automatic copyright. Registration creates a public record and
gives you a certificate you can use as evidence of ownership.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT'S IN THIS PACKAGE?
───────────────────────
• images/           — Your artwork files, one per work.
                      These are the deposit copies required by the Copyright Office.

• artworks-copyright.csv
                    — A spreadsheet with title, year, medium, dimensions,
                      and copyright information for each work.
                      Use this to fill out the online registration form.

• copyright-guide.txt (this file)
                    — Step-by-step instructions for completing your registration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP-BY-STEP: REGISTERING WITH THE eCO ONLINE SYSTEM
──────────────────────────────────────────────────────

STEP 1 — Create an account at copyright.gov
  Go to: https://eco.copyright.gov
  Click "If you are a new user, click here to register" and create a free account.
  You will use this account to track all your registrations.

STEP 2 — Start a new registration
  After logging in, click "Register a New Claim" on the dashboard.
  Choose "Standard Application" for a single work, OR choose
  "Group Registration for Unpublished Works (GRUW)" to register up
  to 750 unpublished works in a single filing (much more cost-effective).

  Recommended for most artists: GRUW if registering multiple unpublished works.

STEP 3 — Fill out the application form
  The artworks-copyright.csv in this package contains all the information
  you need. For each section of the form:

  • "Type of Work" → Visual Art
  • "Title" → Use the title from the CSV
  • "Year of Creation" → Use the "Year Created" column
  • "Author" → Your legal full name (${artistName})
  • "Copyright Claimant" → Same as author (unless you've transferred rights)
  • "Rights and Permissions" → Your contact info or studio email
  • "Limitation of Claim" → Leave blank for entirely new original works

STEP 4 — Upload your deposit copies
  The Copyright Office requires you to upload digital copies of the works.
  Use the image files from the images/ folder in this ZIP.
  Accepted formats: JPEG, PNG, GIF, TIFF, PDF.
  For visual art, one image per work is standard.

STEP 5 — Pay the filing fee
  As of 2025, fees are approximately:
  • Single work (Standard Application): $65 online
  • Group of unpublished works (GRUW): $85 for up to 750 works online
  Payment is by credit/debit card or Copyright Office deposit account.

STEP 6 — Submit and save your confirmation
  After submitting, you will receive a Service Request Number (case number).
  Save this email. Processing typically takes 3–8 months for online filings.
  You can check status at https://eco.copyright.gov at any time.

STEP 7 — You receive your certificate
  The Copyright Office will mail you an official Certificate of Registration.
  Store it safely — it is your legal proof of ownership and registration date.
  Add the registration number to each artwork's record in ArtisTrust using
  the Copyright fields in the artwork detail panel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIPS
────
• "Unpublished" means the work has NOT been publicly distributed, sold, or
  publicly displayed. Most works in a private catalogue qualify.
• Register in groups to save money. One GRUW filing covers up to 750 works
  for $85 total — about $0.11 per work.
• Keep a copy of this package in a safe place as your records.
• You can register published and unpublished works separately if needed.

QUESTIONS?
──────────
Copyright Office information line: 1-877-476-0778
Online help center: https://www.copyright.gov/help/
eCO system: https://eco.copyright.gov
`
}

export async function generateCopyrightPackage(
  artworks: Artwork[],
  artistName: string,
): Promise<Blob> {
  const zip = new JSZip()
  const imagesFolder = zip.folder('images')!

  // Fetch and add each artwork image
  const imagePromises = artworks.map(async (artwork) => {
    // Skip artworks that are still in base64 transient state
    if (!artwork.imageData.startsWith('http')) return

    try {
      const response = await fetch(artwork.imageData)
      if (!response.ok) return
      const blob = await response.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg'
      const title = artwork.title || artwork.aiAnalysis?.suggestedTitle || 'untitled'
      const filename = `${sanitizeFilename(title)}-${artwork.id.slice(0, 8)}.${ext}`
      imagesFolder.file(filename, blob)
    } catch {
      // Skip images that fail to fetch — don't block the whole export
    }
  })

  await Promise.all(imagePromises)

  // Add CSV
  zip.file('artworks-copyright.csv', buildCsv(artworks))

  // Add guide
  zip.file('copyright-guide.txt', buildGuide(artistName, artworks.length))

  return zip.generateAsync({ type: 'blob' })
}

// ─── Photograph Group Registration ───────────────────────────────────────────
// Follows the U.S. Copyright Office "Group Registration of Unpublished
// Photographs" Title Template (750 works per filing, Form VA/GRUWP).

function buildPhotographTitleCsv(group: Artwork[], groupStartIndex: number): string {
  const allTitles = group.map(a => a.title || a.aiAnalysis?.suggestedTitle || 'Untitled')
  const groupTitlesList = allTitles.join(', ')

  const headers = [
    'Photograph Number',
    'Title of Photograph',
    'File Name of Photograph',
    'List of All Group Titles',
    'Missing Information (If any)',
  ]

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const rows = group.map((a, i) => {
    const photoNum = groupStartIndex + i + 1
    const title = a.title || a.aiAnalysis?.suggestedTitle || ''
    const fileName = a.fileName || ''
    const missing: string[] = []
    if (!title) missing.push('Title missing')
    if (!fileName) missing.push('File name missing')
    return [
      String(photoNum),
      title || 'Untitled',
      fileName,
      // Only populate this column in the first row to avoid redundancy,
      // but the Copyright Office template puts it in every row so they can
      // copy any single cell into the eCO "Photograph Titles" field.
      groupTitlesList,
      missing.join('; '),
    ].map(escape).join(',')
  })

  return [headers.map(escape).join(','), ...rows].join('\r\n')
}

function buildPasteIntoEco(group: Artwork[]): string {
  const titles = group.map(a => a.title || a.aiAnalysis?.suggestedTitle || 'Untitled')
  return `PASTE THIS ENTIRE BLOCK INTO THE "PHOTOGRAPH TITLES" FIELD IN THE eCO SYSTEM
──────────────────────────────────────────────────────────────────────────────
Select all text between the dashed lines and paste it into the
"Photograph Titles" field on the Titles screen of the eCO application.

${titles.join(', ')}
`
}

export async function generatePhotographsPackage(
  artworks: Artwork[],
  artistName: string,
  groupSize = 750,
): Promise<Blob> {
  const zip = new JSZip()
  const date = new Date().toISOString().slice(0, 10)

  // Chunk into groups
  const groups: Artwork[][] = []
  for (let i = 0; i < artworks.length; i += groupSize) {
    groups.push(artworks.slice(i, i + groupSize))
  }

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const groupLabel = `group_${gi + 1}`
    const folder = zip.folder(groupLabel)!
    const imagesFolder = folder.folder('images')!

    // CSV title template
    folder.file(`${groupLabel}-title-template.csv`, buildPhotographTitleCsv(group, gi * groupSize))

    // Plain-text paste helper
    folder.file('PASTE-INTO-ECO.txt', buildPasteIntoEco(group))

    // Deposit copy images
    const imagePromises = group.map(async (artwork, i) => {
      if (!artwork.imageData.startsWith('http')) return
      try {
        const response = await fetch(artwork.imageData)
        if (!response.ok) return
        const blob = await response.blob()
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg'
        const title = artwork.title || artwork.aiAnalysis?.suggestedTitle || 'untitled'
        const num = String(gi * groupSize + i + 1).padStart(3, '0')
        const filename = `${num}-${sanitizeFilename(title)}.${ext}`
        imagesFolder.file(filename, blob)
      } catch {
        // Skip images that fail to fetch — don't block the export
      }
    })
    await Promise.all(imagePromises)
  }

  return zip.generateAsync({ type: 'blob', comment: `Copyright package for ${artistName} — generated ${date}` })
}
