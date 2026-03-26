import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Artwork } from './types'
import type { ProfileSettings } from './types'

/**
 * Generate a PDF catalogue for the user's artwork archive.
 * Formatted as a printable table with title, year, medium, dimensions, and copyright.
 */
export async function generatePdfCatalogue(
  artworks: Artwork[],
  profile: ProfileSettings | null,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const artistName = profile?.fullName ?? 'Artist'
  const studioName = profile?.studioName ?? ''
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Cover header ──────────────────────────────────────────────────────────
  const accentRgb = [201, 169, 110] as [number, number, number]
  doc.setFillColor(24, 24, 24)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setTextColor(...accentRgb)
  doc.setFontSize(24)
  doc.setFont('times', 'italic')
  doc.text(artistName, 20, 28)

  if (studioName) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 140, 100)
    doc.text(studioName.toUpperCase(), 20, 36)
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 110, 90)
  doc.text(`Catalogue · ${artworks.length} works · Generated ${dateStr}`, 20, 44)

  // Separator line
  doc.setDrawColor(...accentRgb)
  doc.setLineWidth(0.3)
  doc.line(20, 48, 190, 48)

  // ── Table ─────────────────────────────────────────────────────────────────
  const rows = artworks.map((a, idx) => {
    const dims = a.width && a.height ? `${a.width} × ${a.height} ${a.unit}` : '—'
    const medium = a.material || a.aiAnalysis?.medium || '—'
    const copyright = a.copyrightStatus === 'registered'
      ? `© ${a.copyrightYear} ${a.copyrightHolder} (Reg. ${a.copyrightRegNumber || 'N/A'})`
      : `© ${a.copyrightYear} ${a.copyrightHolder}`

    return [
      String(idx + 1),
      a.title || a.aiAnalysis?.suggestedTitle || 'Untitled',
      a.year || '—',
      medium,
      dims,
      copyright,
    ]
  })

  autoTable(doc, {
    startY: 54,
    head: [['#', 'Title', 'Year', 'Medium', 'Dimensions', 'Copyright']],
    body: rows,
    theme: 'plain',
    headStyles: {
      fillColor: [30, 28, 24],
      textColor: accentRgb,
      fontStyle: 'normal',
      fontSize: 7,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
    },
    bodyStyles: {
      fillColor: [18, 18, 16],
      textColor: [200, 190, 170],
      fontSize: 7,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
    },
    alternateRowStyles: {
      fillColor: [22, 21, 18],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 50 },
      2: { cellWidth: 14 },
      3: { cellWidth: 32 },
      4: { cellWidth: 28 },
      5: { cellWidth: 48 },
    },
    margin: { left: 20, right: 20 },
    tableLineColor: [60, 55, 45],
    tableLineWidth: 0.1,
  })

  // ── Footer on each page ───────────────────────────────────────────────────
  const totalPages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 75, 65)
    doc.text(`ArtisTrust · ${artistName}`, 20, 290)
    doc.text(`Page ${i} / ${totalPages}`, 150, 290, { align: 'right' })
  }

  return doc.output('blob')
}
