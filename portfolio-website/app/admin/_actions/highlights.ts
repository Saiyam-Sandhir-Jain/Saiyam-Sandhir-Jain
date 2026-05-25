'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

export type HighlightSlot = 'project' | 'research' | 'patent'

export interface ModalLink {
  label: string
  url:   string
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

  const { error } = await db
    .from('highlights')
    .update({ ...data, updated_at: new Date().toISOString() })
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

  if (!file || file.size === 0) throw new Error('No file provided')

  const ext    = file.name.split('.').pop()
  const path   = `${slot}.${ext}`
  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

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

  // Append a cache-busting timestamp so re-uploads always show the new image
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db
    .from('highlights')
    .update({ image_url: bustedUrl, updated_at: new Date().toISOString() })
    .eq('slot', slot)

  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

// ─── Delete a highlight tile image ───────────────────────────────────────────
export async function deleteHighlightImage(slot: HighlightSlot) {
  const db = await requireAdmin()

  const { data } = await db
    .from('highlights')
    .select('image_url')
    .eq('slot', slot)
    .single()

  if (data?.image_url) {
    const fileName = data.image_url.split('/').pop()
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
