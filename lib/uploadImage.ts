import { supabase } from './supabase'

/**
 * Uploads an image file to Supabase Storage.
 * Path: artworks/{userId}/{artworkId}
 * Returns the public URL.
 */
export async function uploadImage(
  file: File,
  userId: string,
  artworkId: string
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${artworkId}.${ext}`

  const { error } = await supabase.storage
    .from('artworks')
    .upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })

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
        blob => resolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          : file
        ),
        'image/jpeg', 0.88
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
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
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      const compressed = canvas.toDataURL('image/jpeg', 0.85)
      resolve(compressed)
    }
    img.onerror = () => resolve(base64) // fall back to original on error
    img.src = base64
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
