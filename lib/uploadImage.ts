import { supabase } from './supabase'

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
 */
export async function compressFileForStorage(
  file: File,
  maxDimension = 2400
): Promise<File> {
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
 */
export async function compressFileForAnalysis(
  file: File,
  maxDimension = 1500
): Promise<string> {
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
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']
  const paths = exts.map(ext => `${userId}/${artworkId}.${ext}`)
  await supabase.storage.from('artworks').remove(paths)
}
