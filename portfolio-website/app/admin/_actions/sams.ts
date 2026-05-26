'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin }   from './guard'

// ─── Allowed image types ──────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_IMAGE_EXT  = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const MAX_IMAGE_BYTES    = 5 * 1024 * 1024  // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

/**
 * Upload a Sams avatar photo to Supabase Storage (avatars bucket, path: sams/avatar.<ext>)
 * and persist the URL in about_profile.sams_avatar_url.
 */
export async function uploadSamsAvatar(formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('sams_avatar') as File

  if (!file || file.size === 0)            throw new Error('No file provided')
  if (file.size > MAX_IMAGE_BYTES)         throw new Error('Image must be under 5 MB')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXT.has(ext))         throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed')
  if (!ALLOWED_IMAGE_MIME.has(file.type))  throw new Error('Invalid image content type')

  // Use MIME-derived extension rather than user-supplied filename
  const safeExt = MIME_TO_EXT[file.type] ?? 'jpg'
  const path    = `sams/avatar.${safeExt}`
  const bytes   = await file.arrayBuffer()
  const buffer  = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(path)
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('about_profile')
    .update({ sams_avatar_url: bustedUrl, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

/**
 * Delete Sams avatar from storage and clear the DB column.
 */
export async function deleteSamsAvatar() {
  const db = await requireAdmin()

  const { data: profile } = await db
    .from('about_profile')
    .select('sams_avatar_url')
    .single()

  if (profile?.sams_avatar_url) {
    const url      = profile.sams_avatar_url as string
    const match    = url.match(/\/avatars\/(.+?)(\?|$)/)
    const filePath = match?.[1]
    if (filePath) await db.storage.from('avatars').remove([filePath])
  }

  await db
    .from('about_profile')
    .update({ sams_avatar_url: null, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  revalidatePath('/')
  return { success: true }
}
