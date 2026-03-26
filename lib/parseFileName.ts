/**
 * parseFileName — extracts metadata hints from a filename and optional folder path.
 *
 * Currently extracts:
 *   - year: first 4-digit number in the range 1900–2099 found in the name or path
 *
 * Returns empty object if nothing useful is found. Never throws.
 */

export interface FileNameHints {
  year?: string
}

const YEAR_RE = /\b((?:19|20)\d{2})\b/

export function parseHints(fileName: string, folderPath?: string): FileNameHints {
  // Strip extension from filename before searching so "image2019.jpg" still matches
  const baseName = fileName.replace(/\.[^/.]+$/, '')

  const fromName = baseName.match(YEAR_RE)
  if (fromName) return { year: fromName[1] }

  if (folderPath) {
    const fromPath = folderPath.match(YEAR_RE)
    if (fromPath) return { year: fromPath[1] }
  }

  return {}
}
