'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

// ─── Update text-based profile fields ────────────────────────────────────────
export async function updateProfileText(formData: FormData) {
  const db = await requireAdmin()

  const { error } = await db
    .from('about_profile')
    .update({
      title:      formData.get('title')     as string,
      bio:        formData.get('bio')       as string,
      email:      formData.get('email')     as string,
      available:  formData.get('available') === 'true',
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

  const { error } = await db
    .from('about_profile')
    .update({
      social_links: links,
      updated_at:   new Date().toISOString(),
    })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Upload avatar to Supabase Storage ───────────────────────────────────────
export async function uploadAvatar(formData: FormData) {
  const db = await requireAdmin()
  const file = formData.get('avatar') as File
  if (!file || file.size === 0) throw new Error('No file provided')

  const ext      = file.name.split('.').pop()
  const path     = `avatar.${ext}`
  const bytes    = await file.arrayBuffer()
  const buffer   = new Uint8Array(bytes)

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
  if (!file || file.size === 0) throw new Error('No file provided')

  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('resumes')
    .upload('resume.pdf', buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('resumes').getPublicUrl('resume.pdf')

  const { error: dbError } = await db
    .from('about_profile')
    .update({ resume_url: publicUrl, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/')
  return { success: true, url: publicUrl }
}

