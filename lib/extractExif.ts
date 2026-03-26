/**
 * extractExif — reads EXIF/IPTC metadata from a File object in the browser.
 *
 * Uses the `exifr` library (browser-compatible, handles JPEG, PNG, TIFF, HEIC).
 * Always resolves — returns an empty object if the file has no EXIF or if
 * parsing fails for any reason.
 */

export interface ExifData {
  /** Year the photo was taken, derived from DateTimeOriginal */
  year?: string
  /** Camera manufacturer, e.g. "Canon", "Nikon" */
  cameraMake?: string
  /** Camera model, e.g. "EOS 5D Mark IV" */
  cameraModel?: string
  /** Pixel width of the original file */
  pixelWidth?: number
  /** Pixel height of the original file */
  pixelHeight?: number
  /** Lens model string, e.g. "EF 50mm f/1.4 USM" */
  lens?: string
  /** Aperture as a human-readable string, e.g. "f/2.8" */
  aperture?: string
}

export async function extractExif(file: File): Promise<ExifData> {
  try {
    // Dynamic import so exifr is not bundled into the main chunk
    const exifr = await import('exifr')
    const raw = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal', 'CreateDate',
        'Make', 'Model',
        'ExifImageWidth', 'ExifImageHeight',
        'PixelXDimension', 'PixelYDimension',
        'LensModel',
        'FNumber',
      ],
    })
    if (!raw) return {}

    const result: ExifData = {}

    // Year
    const dateRaw = raw.DateTimeOriginal ?? raw.CreateDate
    if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
      result.year = dateRaw.getFullYear().toString()
    } else if (typeof dateRaw === 'string') {
      // EXIF date string: "2019:07:14 12:30:00"
      const m = dateRaw.match(/^(\d{4})/)
      if (m) result.year = m[1]
    }

    if (raw.Make)  result.cameraMake  = String(raw.Make).trim()
    if (raw.Model) result.cameraModel = String(raw.Model).trim()

    // Pixel dimensions — ExifImageWidth/Height are the preferred source;
    // fall back to PixelXDimension/PixelYDimension (used in some JPEGs)
    const w = raw.ExifImageWidth  ?? raw.PixelXDimension
    const h = raw.ExifImageHeight ?? raw.PixelYDimension
    if (typeof w === 'number' && w > 0) result.pixelWidth  = w
    if (typeof h === 'number' && h > 0) result.pixelHeight = h

    if (raw.LensModel && typeof raw.LensModel === 'string') {
      result.lens = raw.LensModel.trim()
    }

    if (typeof raw.FNumber === 'number') {
      result.aperture = `f/${raw.FNumber}`
    }

    return result
  } catch {
    // Silently swallow any parse error (non-EXIF files, corrupt metadata, etc.)
    return {}
  }
}

/**
 * Convert available EXIF data into camera-namespace tags.
 * These are merged with AI-generated tags but kept in a distinct "camera:" namespace
 * so users can filter by gear without polluting the artistic taxonomies.
 */
export function exifToTags(exif: ExifData): string[] {
  const tags: string[] = []
  if (exif.cameraMake || exif.cameraModel) {
    const cam = [exif.cameraMake, exif.cameraModel].filter(Boolean).join(' ')
    tags.push(`camera:${cam}`)
  }
  if (exif.lens)     tags.push(`lens:${exif.lens}`)
  if (exif.aperture) tags.push(`aperture:${exif.aperture}`)
  return tags
}
