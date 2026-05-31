'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

// ─── Allowed upload types ─────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_IMAGE_EXT  = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const MAX_IMAGE_BYTES    = 5 * 1024 * 1024   // 5 MB
const MAX_PDF_BYTES      = 10 * 1024 * 1024  // 10 MB

function validateImageFile(file: File) {
  if (!file || file.size === 0)            throw new Error('No file provided')
  if (file.size > MAX_IMAGE_BYTES)         throw new Error('Image must be under 5 MB')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXT.has(ext))         throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed')
  if (!ALLOWED_IMAGE_MIME.has(file.type))  throw new Error('Invalid image content type')
}

// ─── Update text-based profile fields ────────────────────────────────────────
export async function updateProfileText(formData: FormData) {
  const db = await requireAdmin()

  const title     = (formData.get('title')     as string | null)?.slice(0, 200)  ?? ''
  const bio       = (formData.get('bio')       as string | null)?.slice(0, 2000) ?? ''
  const email     = (formData.get('email')     as string | null)?.slice(0, 200)  ?? ''
  const available = formData.get('available') === 'true'

  // Basic email format guard
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address')
  }

  const { error } = await db
    .from('about_profile')
    .update({
      title,
      bio,
      email,
      available,
      updated_at: new Date().toISOString(),
    })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Update footer social links ───────────────────────────────────────────────
export async function updateSocialLinks(links: Array<{ label: string; url: string; icon: string }>) {
  const db = await requireAdmin()

  // Sanitise each link — strip excessively long strings and enforce https/mailto
  const clean = links.slice(0, 20).map(l => ({
    label: String(l.label).slice(0, 100),
    icon:  String(l.icon).slice(0, 100),
    url:   /^https?:\/\/|^mailto:/.test(l.url) ? String(l.url).slice(0, 500) : '#',
  }))

  const { error } = await db
    .from('about_profile')
    .update({
      social_links: clean,
      updated_at:   new Date().toISOString(),
    })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Upload avatar to Supabase Storage ───────────────────────────────────────
export async function uploadAvatar(formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('avatar') as File

  validateImageFile(file)

  // Use a fixed, trusted extension derived from the MIME type — not the file name
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/gif':  'gif',
  }
  const ext    = mimeToExt[file.type] ?? 'jpg'
  const path   = `avatar.${ext}`
  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(path)
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('about_profile')
    .update({ avatar_url: bustedUrl, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

// ─── Delete avatar ────────────────────────────────────────────────────────────
export async function deleteAvatar() {
  const db = await requireAdmin()

  const { data: profile } = await db.from('about_profile').select('avatar_url').single()
  if (profile?.avatar_url) {
    const fileName = profile.avatar_url.split('/').pop()?.split('?')[0]
    if (fileName) await db.storage.from('avatars').remove([fileName])
  }

  await db
    .from('about_profile')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  revalidatePath('/')
  return { success: true }
}

// ─── Upload resume PDF ────────────────────────────────────────────────────────
export async function uploadResume(formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('resume') as File
  if (!file || file.size === 0)             throw new Error('No file provided')
  if (file.size > MAX_PDF_BYTES)            throw new Error('PDF must be under 10 MB')
  if (file.type !== 'application/pdf')      throw new Error('Only PDF files are allowed')
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf')                        throw new Error('File must have a .pdf extension')

  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('resumes')
    .upload('resume.pdf', buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('resumes').getPublicUrl('resume.pdf')
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('about_profile')
    .update({ resume_url: bustedUrl, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

// ─── Upload favicon ───────────────────────────────────────────────────────────
const ALLOWED_FAVICON_EXT  = new Set(['ico', 'png', 'svg'])
const ALLOWED_FAVICON_MIME = new Set(['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'])
const MAX_FAVICON_BYTES    = 1 * 1024 * 1024  // 1 MB

export async function uploadFavicon(formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('favicon') as File

  if (!file || file.size === 0)              throw new Error('No file provided')
  if (file.size > MAX_FAVICON_BYTES)         throw new Error('Favicon must be under 1 MB')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_FAVICON_EXT.has(ext))         throw new Error('Only .ico, .png, or .svg favicons are allowed')
  // SVG may come with text/xml or image/svg+xml — be permissive for SVG
  if (ext !== 'svg' && !ALLOWED_FAVICON_MIME.has(file.type)) throw new Error('Invalid favicon content type')

  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)
  const path   = `favicon.${ext}`

  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(path)
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('about_profile')
    .update({ favicon_url: bustedUrl, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}
