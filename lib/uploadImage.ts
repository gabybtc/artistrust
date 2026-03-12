import { supabase } from './supabase'

// utif2 has no published @types package — declare the subset we use.
declare module 'utif2' {
  interface IFD { width: number; height: number; [key: string]: unknown }
  export function decode(buf: ArrayBuffer): IFD[]
  export function decodeImage(buf: ArrayBuffer, ifd: IFD): void
  export function toRGBA8(ifd: IFD): Uint8Array
}

function isTiff(file: File): boolean {
  return file.type === 'image/tiff' || /\.tiff?$/i.test(file.name)
}

/**
 * Decodes a TIFF file into an HTMLCanvasElement using utif2.
 * Falls back to null on any error, letting callers use the original file.
 */
async function tiffToCanvas(file: File): Promise<HTMLCanvasElement | null> {
  try {
    const UTIF = await import('utif2')
    const buf  = await file.arrayBuffer()
    const ifds = UTIF.decode(buf)
    if (!ifds.length) return null
    UTIF.decodeImage(buf, ifds[0])
    const rgba   = UTIF.toRGBA8(ifds[0])
    const { width, height } = ifds[0]
    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)
    return canvas
  } catch {
    return null
  }
}
/**
 * Uploads an image file to Supabase Storage.
 * Path: artworks/{userId}/{artworkId}
 * Returns the public URL.
 */
export async function uploadImage(
  file: File,
  userId: string,
  artworkId: string,
  timeoutMs = 120_000
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${artworkId}.${ext}`

  // Race the upload against a timeout — Supabase has no built-in timeout and a
  // stalled network connection would otherwise hang forever.
  const uploadPromise = supabase.storage
    .from('artworks')
    .upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out')), timeoutMs)
  )

  const { error } = await Promise.race([uploadPromise, timeoutPromise])

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from('artworks').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Compresses an image File before upload to Supabase Storage.
 * Resizes to max 2400px on the longest edge at 88% JPEG quality.
 * Reduces a 20 MB DSLR file to ~1–3 MB while keeping it visually lossless.
 * TIFF files are decoded via utif2 since browsers cannot render them natively.
 */
export async function compressFileForStorage(
  file: File,
  maxDimension = 2400
): Promise<File> {
  // TIFF: decode with utif2 first, then compress the resulting canvas
  if (isTiff(file)) {
    const canvas = await tiffToCanvas(file)
    if (canvas) {
      return new Promise((resolve) => {
        let settled = false
        const fallback = setTimeout(() => { if (!settled) { settled = true; resolve(file) } }, 15_000)
        const safeResolve = (f: File) => { if (!settled) { settled = true; clearTimeout(fallback); resolve(f) } }
        const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height))
        const out   = document.createElement('canvas')
        out.width   = Math.round(canvas.width  * scale)
        out.height  = Math.round(canvas.height * scale)
        out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height)
        out.toBlob(
          blob => safeResolve(blob
            ? new File([blob], file.name.replace(/\.tiff?$/i, '.jpg'), { type: 'image/jpeg' })
            : file
          ),
          'image/jpeg', 0.88
        )
      })
    }
    // utif2 failed — fall through to the normal path (img.onerror will catch it)
  }

  return new Promise((resolve) => {
    let settled = false
    // canvas.toBlob() can silently never call its callback under memory pressure.
    // Fall back to the original file after 15 s so the upload always proceeds.
    const fallback = setTimeout(() => { if (!settled) { settled = true; resolve(file) } }, 15_000)
    const safeResolve = (f: File) => { if (!settled) { settled = true; clearTimeout(fallback); resolve(f) } }

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => safeResolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          : file
        ),
        'image/jpeg', 0.88
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); safeResolve(file) }
    img.src = url
  })
}

/**
 * Compresses a base64 image to a max dimension for sending to the Claude API.
 * Reduces large DSLR/scan payloads from ~20MB down to ~200-400KB.
 */
export async function compressBase64ForAnalysis(
  base64: string,
  maxDimension = 1500
): Promise<string> {
  return new Promise((resolve) => {
    let settled = false
    const fallback = setTimeout(() => { if (!settled) { settled = true; resolve(base64) } }, 15_000)
    const safeResolve = (s: string) => { if (!settled) { settled = true; clearTimeout(fallback); resolve(s) } }

    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      const compressed = canvas.toDataURL('image/jpeg', 0.85)
      safeResolve(compressed)
    }
    img.onerror = () => safeResolve(base64)
    img.src = base64
  })
}

/**
 * Compresses an image File directly for sending to the Claude API.
 * Uses an object URL internally — never materialises a large base64 in the JS heap,
 * which keeps memory flat regardless of batch size.
 * TIFF files are decoded via utif2 since browsers cannot render them natively.
 */
export async function compressFileForAnalysis(
  file: File,
  maxDimension = 1500
): Promise<string> {
  // TIFF: decode with utif2 first
  if (isTiff(file)) {
    const canvas = await tiffToCanvas(file)
    if (canvas) {
      return new Promise((resolve, reject) => {
        let settled = false
        const fallback = setTimeout(
          () => { if (!settled) { settled = true; reject(new Error('compressFileForAnalysis timed out')) } },
          15_000
        )
        const done = (result: string | Error) => {
          if (settled) return; settled = true; clearTimeout(fallback)
          if (result instanceof Error) reject(result); else resolve(result)
        }
        const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height))
        const out   = document.createElement('canvas')
        out.width   = Math.round(canvas.width  * scale)
        out.height  = Math.round(canvas.height * scale)
        out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height)
        done(out.toDataURL('image/jpeg', 0.85))
      })
    }
    // utif2 failed — fall through, img.onerror will reject with 'Image load failed'
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const fallback = setTimeout(
      () => { if (!settled) { settled = true; reject(new Error('compressFileForAnalysis timed out')) } },
      15_000
    )
    const done = (result: string | Error) => {
      if (settled) return
      settled = true
      clearTimeout(fallback)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      done(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); done(new Error('Image load failed')) }
    img.src = url
  })
}

/**
 * Deletes an image from Supabase Storage.
 * Tries common extensions — safe to call even if file doesn't exist.
 */
export async function deleteImage(userId: string, artworkId: string): Promise<void> {
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'tif', 'tiff']
  const paths = exts.map(ext => `${userId}/${artworkId}.${ext}`)
  await supabase.storage.from('artworks').remove(paths)
}
