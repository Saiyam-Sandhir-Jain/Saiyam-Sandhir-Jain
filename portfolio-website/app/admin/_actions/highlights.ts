'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

export type HighlightSlot = 'project' | 'research' | 'patent'

export interface ModalLink {
  label: string
  url:   string
}

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

// ─── Update a highlight tile's basic fields ───────────────────────────────────
export async function updateHighlightText(
  slot:    HighlightSlot,
  data: {
    heading:          string
    subheading:       string
    modal_heading:    string
    modal_subheading: string
    modal_abstract:   string
    modal_tags:       string[]
    modal_links:      ModalLink[]
  }
) {
  const db = await requireAdmin()

  // Validate slot value to prevent unexpected DB writes
  if (!['project', 'research', 'patent'].includes(slot)) {
    throw new Error('Invalid slot value')
  }

  // Sanitise text lengths
  const clean = {
    heading:          String(data.heading).slice(0, 200),
    subheading:       String(data.subheading).slice(0, 500),
    modal_heading:    String(data.modal_heading).slice(0, 200),
    modal_subheading: String(data.modal_subheading).slice(0, 500),
    modal_abstract:   String(data.modal_abstract).slice(0, 5000),
    modal_tags:       data.modal_tags.slice(0, 20).map(t => String(t).slice(0, 50)),
    modal_links:      data.modal_links.slice(0, 10).map(l => ({
      label: String(l.label).slice(0, 100),
      url:   /^https?:\/\//.test(l.url) ? String(l.url).slice(0, 500) : '#',
    })),
  }

  const { error } = await db
    .from('highlights')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('slot', slot)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Upload an image for a highlight tile ─────────────────────────────────────
export async function uploadHighlightImage(
  slot:     HighlightSlot,
  formData: FormData
) {
  const db   = await requireAdmin()
  const file = formData.get('image') as File

  if (!file || file.size === 0)            throw new Error('No file provided')
  if (file.size > MAX_IMAGE_BYTES)         throw new Error('Image must be under 5 MB')
  if (!['project', 'research', 'patent'].includes(slot)) throw new Error('Invalid slot')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXT.has(ext))         throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed')
  if (!ALLOWED_IMAGE_MIME.has(file.type))  throw new Error('Invalid image content type')

  // Derive extension from MIME type, not user-supplied filename
  const safeExt = MIME_TO_EXT[file.type] ?? 'jpg'
  const path    = `${slot}.${safeExt}`
  const bytes   = await file.arrayBuffer()
  const buffer  = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('highlights')
    .upload(path, buffer, {
      contentType: file.type,
      upsert:      true,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage
    .from('highlights')
    .getPublicUrl(path)

  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('highlights')
    .update({ image_url: bustedUrl, updated_at: new Date().toISOString() })
    .eq('slot', slot)

  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

// ─── Upload the phone mockup image for the project tile ───────────────────────
export async function uploadPhoneImage(formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('phone_image') as File

  if (!file || file.size === 0)   throw new Error('No file provided')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be under 5 MB')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXT.has(ext))        throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed')
  if (!ALLOWED_IMAGE_MIME.has(file.type)) throw new Error('Invalid image content type')

  const safeExt = MIME_TO_EXT[file.type] ?? 'png'
  const path    = `project_phone.${safeExt}`
  const bytes   = await file.arrayBuffer()
  const buffer  = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('highlights')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('highlights').getPublicUrl(path)
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('highlights')
    .update({ phone_image_url: bustedUrl, updated_at: new Date().toISOString() })
    .eq('slot', 'project')

  if (dbError) throw new Error(dbError.message)
  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

// ─── Delete the phone mockup image for the project tile ───────────────────────
export async function deletePhoneImage() {
  const db = await requireAdmin()

  const { data } = await db
    .from('highlights')
    .select('phone_image_url')
    .eq('slot', 'project')
    .single()

  if (data?.phone_image_url) {
    const fileName = data.phone_image_url.split('/').pop()?.split('?')[0]
    if (fileName) await db.storage.from('highlights').remove([fileName])
  }

  await db
    .from('highlights')
    .update({ phone_image_url: null, updated_at: new Date().toISOString() })
    .eq('slot', 'project')

  revalidatePath('/')
  return { success: true }
}
export async function deleteHighlightImage(slot: HighlightSlot) {
  const db = await requireAdmin()

  if (!['project', 'research', 'patent'].includes(slot)) {
    throw new Error('Invalid slot value')
  }

  const { data } = await db
    .from('highlights')
    .select('image_url')
    .eq('slot', slot)
    .single()

  if (data?.image_url) {
    const fileName = data.image_url.split('/').pop()?.split('?')[0]
    if (fileName) {
      await db.storage.from('highlights').remove([fileName])
    }
  }

  await db
    .from('highlights')
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq('slot', slot)

  revalidatePath('/')
  return { success: true }
}
