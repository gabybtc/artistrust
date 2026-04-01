import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Artwork } from './types'
import type { ProfileSettings } from './types'

// ── Thumbnail loader ──────────────────────────────────────────────────────────
// Loads any image src (data URL or remote URL) into a canvas and returns a
// compact JPEG data URL plus the original aspect ratio (w/h).
type Thumb = { dataUrl: string; aspect: number } | null

async function toJpegDataUrl(src: string, maxPx = 160): Promise<Thumb> {
  if (!src) return null
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const nw = img.naturalWidth || 1
        const nh = img.naturalHeight || 1
        const scale = Math.min(1, maxPx / Math.max(nw, nh))
        const w = Math.max(1, Math.round(nw * scale))
        const h = Math.max(1, Math.round(nh * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.78), aspect: nw / nh })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// ── PDF generator ─────────────────────────────────────────────────────────────
export async function generatePdfCatalogue(
  artworks: Artwork[],
  profile: ProfileSettings | null,
): Promise<Blob> {
  // Load all thumbnails before building the PDF (parallel fetch)
  const thumbs = await Promise.all(artworks.map(a => toJpegDataUrl(a.imageData)))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const artistName = profile?.fullName ?? 'Artist'
  const studioName = profile?.studioName ?? ''
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // Print-safe gold — dark enough to read on white
  const accentRgb = [148, 112, 48] as [number, number, number]

  // ── Header ────────────────────────────────────────────────────────────────
  // White page (no fill needed — jsPDF default is white, but be explicit)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setTextColor(...accentRgb)
  doc.setFontSize(24)
  doc.setFont('times', 'italic')
  doc.text(artistName, 20, 28)

  if (studioName) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 100, 50)
    doc.text(studioName.toUpperCase(), 20, 36)
  }

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110, 98, 78)
  doc.text(`Catalog · ${artworks.length} works · ${dateStr}`, 20, studioName ? 44 : 36)

  const separatorY = studioName ? 48 : 40
  doc.setDrawColor(...accentRgb)
  doc.setLineWidth(0.3)
  doc.line(20, separatorY, 190, separatorY)

  // ── Table ─────────────────────────────────────────────────────────────────
  const THUMB_W = 18   // mm
  const THUMB_H = 18   // mm
  const ROW_H   = 20   // mm — enough for the thumbnail

  const rows = artworks.map(a => {
    const dims = a.width && a.height ? `${a.width} × ${a.height} ${a.unit}` : '—'
    const medium = a.material || a.aiAnalysis?.medium || '—'
    const copyright = a.copyrightStatus === 'registered'
      ? `© ${a.copyrightYear} ${a.copyrightHolder} (Reg. ${a.copyrightRegNumber || 'N/A'})`
      : `© ${a.copyrightYear || ''} ${a.copyrightHolder || ''}`
    return [
      '',   // thumbnail slot — filled via didDrawCell
      a.title || a.aiAnalysis?.suggestedTitle || 'Untitled',
      a.year || '—',
      medium,
      dims,
      copyright,
    ]
  })

  autoTable(doc, {
    startY: separatorY + 4,
    head: [['', 'Title', 'Year', 'Medium', 'Dimensions', 'Copyright']],
    body: rows,
    theme: 'plain',
    headStyles: {
      fillColor: [244, 240, 232],
      textColor: accentRgb,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 25, 20],
      fontSize: 7,
      cellPadding: { top: 1, right: 3, bottom: 1, left: 3 },
      minCellHeight: ROW_H,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [250, 247, 242],
    },
    columnStyles: {
      0: { cellWidth: 22 },   // thumbnail  (22)
      1: { cellWidth: 40 },   // title      (40)
      2: { cellWidth: 12 },   // year       (12)
      3: { cellWidth: 28 },   // medium     (28)
      4: { cellWidth: 22 },   // dimensions (22)
      5: { cellWidth: 46 },   // copyright  (46)
    },                        // total = 170 = 210 − 20 − 20
    margin: { left: 20, right: 20 },
    tableLineColor: [210, 202, 188],
    tableLineWidth: 0.15,
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const thumb = thumbs[data.row.index]
        if (thumb) {
          try {
            // Fit image within the cell box, preserving aspect ratio
            const maxW = THUMB_W
            const maxH = THUMB_H
            let drawW: number, drawH: number
            if (thumb.aspect >= 1) {
              // landscape
              drawW = maxW
              drawH = maxW / thumb.aspect
            } else {
              // portrait
              drawH = maxH
              drawW = maxH * thumb.aspect
            }
            const imgX = data.cell.x + 1 + (maxW - drawW) / 2
            const imgY = data.cell.y + (data.cell.height - drawH) / 2
            doc.addImage(thumb.dataUrl, 'JPEG', imgX, imgY, drawW, drawH)
          } catch {
            // skip if image embedding fails for this row
          }
        }
      }
    },
  })

  // ── Footer on each page ───────────────────────────────────────────────────
  const totalPages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(210, 200, 182)
    doc.setLineWidth(0.2)
    doc.line(20, 286, 190, 286)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 135, 110)
    doc.text(`ArtisTrust · ${artistName}`, 20, 290)
    doc.text(`Page ${i} / ${totalPages}`, 190, 290, { align: 'right' })
  }

  return doc.output('blob')
}
