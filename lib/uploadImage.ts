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
 * Deletes an image from Supabase Storage.
 * Tries common extensions — safe to call even if file doesn't exist.
 */
export async function deleteImage(userId: string, artworkId: string): Promise<void> {
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']
  const paths = exts.map(ext => `${userId}/${artworkId}.${ext}`)
  await supabase.storage.from('artworks').remove(paths)
}
