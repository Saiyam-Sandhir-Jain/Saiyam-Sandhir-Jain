'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin }   from './guard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArray(raw: FormDataEntryValue | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw as string) } catch { return [] }
}

async function getMaxSortOrder(db: Awaited<ReturnType<typeof requireAdmin>>, table: string) {
  const { data } = await (db as any).from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1)
  return data?.[0]?.sort_order ?? -1
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH PAPERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addPaper(formData: FormData) {
  const db  = await requireAdmin()
  const max = await getMaxSortOrder(db, 'research_papers')

  const { error } = await db.from('research_papers').insert({
    title:       (formData.get('title')       as string) ?? '',
    status:      (formData.get('status')      as string) ?? 'upcoming',
    venue:       (formData.get('venue')       as string) ?? '',
    year:        parseInt((formData.get('year') as string) ?? '0', 10),
    authors:     parseArray(formData.get('authors')),
    abstract:    (formData.get('abstract')    as string) ?? '',
    tags:        parseArray(formData.get('tags')),
    scholar_url: (formData.get('scholar_url') as string) || null,
    sort_order:  max + 1,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function updatePaper(id: string, formData: FormData) {
  const db = await requireAdmin()

  const { error } = await db.from('research_papers').update({
    title:       (formData.get('title')       as string) ?? '',
    status:      (formData.get('status')      as string) ?? 'upcoming',
    venue:       (formData.get('venue')       as string) ?? '',
    year:        parseInt((formData.get('year') as string) ?? '0', 10),
    authors:     parseArray(formData.get('authors')),
    abstract:    (formData.get('abstract')    as string) ?? '',
    tags:        parseArray(formData.get('tags')),
    scholar_url: (formData.get('scholar_url') as string) || null,
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function deletePaper(id: string) {
  const db = await requireAdmin()
  await db.from('highlights').update({ selected_paper_id: null }).eq('selected_paper_id', id)
  const { error } = await db.from('research_papers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function swapPaperOrder(id1: string, order1: number, id2: string, order2: number) {
  const db = await requireAdmin()
  await Promise.all([
    db.from('research_papers').update({ sort_order: order2 }).eq('id', id1),
    db.from('research_papers').update({ sort_order: order1 }).eq('id', id2),
  ])
  revalidatePath('/')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addPatent(formData: FormData) {
  const db  = await requireAdmin()
  const max = await getMaxSortOrder(db, 'patents')

  const { error } = await db.from('patents').insert({
    title:               (formData.get('title')               as string) ?? '',
    status:              (formData.get('status')              as string) ?? 'upcoming',
    registration_number: (formData.get('registration_number') as string) ?? '',
    year:                parseInt((formData.get('year') as string) ?? '0', 10),
    abstract:            (formData.get('abstract')            as string) ?? '',
    tags:                parseArray(formData.get('tags')),
    sort_order:          max + 1,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function updatePatent(id: string, formData: FormData) {
  const db = await requireAdmin()

  const { error } = await db.from('patents').update({
    title:               (formData.get('title')               as string) ?? '',
    status:              (formData.get('status')              as string) ?? 'upcoming',
    registration_number: (formData.get('registration_number') as string) ?? '',
    year:                parseInt((formData.get('year') as string) ?? '0', 10),
    abstract:            (formData.get('abstract')            as string) ?? '',
    tags:                parseArray(formData.get('tags')),
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function deletePatent(id: string) {
  const db = await requireAdmin()
  await db.from('highlights').update({ selected_patent_id: null }).eq('selected_patent_id', id)
  const { error } = await db.from('patents').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function swapPatentOrder(id1: string, order1: number, id2: string, order2: number) {
  const db = await requireAdmin()
  await Promise.all([
    db.from('patents').update({ sort_order: order2 }).eq('id', id1),
    db.from('patents').update({ sort_order: order1 }).eq('id', id2),
  ])
  revalidatePath('/')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════════

export async function addCertificate(formData: FormData) {
  const db  = await requireAdmin()
  const max = await getMaxSortOrder(db, 'certificates')

  const { error } = await db.from('certificates').insert({
    title:      (formData.get('title')    as string) ?? '',
    issuer:     (formData.get('issuer')   as string) ?? '',
    platform:   (formData.get('platform') as string) ?? '',
    year:       (formData.get('year')     as string) ?? '',
    sort_order: max + 1,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function updateCertificate(id: string, formData: FormData) {
  const db = await requireAdmin()

  const { error } = await db.from('certificates').update({
    title:    (formData.get('title')    as string) ?? '',
    issuer:   (formData.get('issuer')   as string) ?? '',
    platform: (formData.get('platform') as string) ?? '',
    year:     (formData.get('year')     as string) ?? '',
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function deleteCertificate(id: string) {
  const db = await requireAdmin()
  const { data } = await db.from('certificates').select('image_url').eq('id', id).single()
  if (data?.image_url) {
    const fileName = data.image_url.split('/').pop()
    if (fileName) await db.storage.from('certificates').remove([fileName])
  }
  const { error } = await db.from('certificates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function uploadCertificateImage(id: string, formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('image') as File
  if (!file || file.size === 0) throw new Error('No file provided')

  const path   = `${id}.jpg`
  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('certificates')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('certificates').getPublicUrl(path)
  const bustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await db.from('certificates').update({ image_url: bustedUrl }).eq('id', id)
  if (dbError) throw new Error(dbError.message)
  revalidatePath('/')
  return { success: true, url: bustedUrl }
}

export async function deleteCertificateImage(id: string) {
  const db = await requireAdmin()
  await db.storage.from('certificates').remove([`${id}.jpg`])
  await db.from('certificates').update({ image_url: null }).eq('id', id)
  revalidatePath('/')
  return { success: true }
}

export async function swapCertificateOrder(id1: string, order1: number, id2: string, order2: number) {
  const db = await requireAdmin()
  await Promise.all([
    db.from('certificates').update({ sort_order: order2 }).eq('id', id1),
    db.from('certificates').update({ sort_order: order1 }).eq('id', id2),
  ])
  revalidatePath('/')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LORs
// ═══════════════════════════════════════════════════════════════════════════════

export async function addLOR(formData: FormData) {
  const db  = await requireAdmin()
  const max = await getMaxSortOrder(db, 'lors')

  const { error } = await db.from('lors').insert({
    recommender_name: (formData.get('recommender_name') as string) ?? '',
    organization:     (formData.get('organization')     as string) ?? '',
    designation:      (formData.get('designation')      as string) ?? '',
    relationship:     (formData.get('relationship')     as string) ?? '',
    available:        formData.get('available') === 'true',
    sort_order:       max + 1,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function updateLOR(id: string, formData: FormData) {
  const db = await requireAdmin()

  const { error } = await db.from('lors').update({
    recommender_name: (formData.get('recommender_name') as string) ?? '',
    organization:     (formData.get('organization')     as string) ?? '',
    designation:      (formData.get('designation')      as string) ?? '',
    relationship:     (formData.get('relationship')     as string) ?? '',
    available:        formData.get('available') === 'true',
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function deleteLOR(id: string) {
  const db = await requireAdmin()
  const { data } = await db.from('lors').select('pdf_url').eq('id', id).single()
  if (data?.pdf_url) {
    const fileName = data.pdf_url.split('/').pop()
    if (fileName) await db.storage.from('lors').remove([fileName])
  }
  const { error } = await db.from('lors').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function uploadLORPdf(id: string, formData: FormData) {
  const db   = await requireAdmin()
  const file = formData.get('pdf') as File
  if (!file || file.size === 0) throw new Error('No file provided')

  const path   = `${id}.pdf`
  const bytes  = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)

  const { error: uploadError } = await db.storage
    .from('lors')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = db.storage.from('lors').getPublicUrl(path)

  const { error: dbError } = await db.from('lors').update({ pdf_url: publicUrl }).eq('id', id)
  if (dbError) throw new Error(dbError.message)
  revalidatePath('/')
  return { success: true, url: publicUrl }
}

export async function deleteLORPdf(id: string) {
  const db = await requireAdmin()
  await db.storage.from('lors').remove([`${id}.pdf`])
  await db.from('lors').update({ pdf_url: null }).eq('id', id)
  revalidatePath('/')
  return { success: true }
}

export async function swapLOROrder(id1: string, order1: number, id2: string, order2: number) {
  const db = await requireAdmin()
  await Promise.all([
    db.from('lors').update({ sort_order: order2 }).eq('id', id1),
    db.from('lors').update({ sort_order: order1 }).eq('id', id2),
  ])
  revalidatePath('/')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT LINKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function selectHighlightPaper(paperId: string | null) {
  const db = await requireAdmin()
  const { error } = await db.from('highlights')
    .update({ selected_paper_id: paperId, updated_at: new Date().toISOString() })
    .eq('slot', 'research')
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

export async function selectHighlightPatent(patentId: string | null) {
  const db = await requireAdmin()
  const { error } = await db.from('highlights')
    .update({ selected_patent_id: patentId, updated_at: new Date().toISOString() })
    .eq('slot', 'patent')
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

