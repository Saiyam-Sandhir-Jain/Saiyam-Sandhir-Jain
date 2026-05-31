'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

// ─── Add a new experience ─────────────────────────────────────────────────────
export async function addExperience(formData: FormData) {
  const db = await requireAdmin()

  // Find current max sort_order
  const { data: existing } = await db
    .from('experience')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const endDate   = formData.get('end_date') as string
  const isCurrent = endDate === 'Present' || endDate.trim() === ''

  const { error } = await db.from('experience').insert({
    role:       formData.get('role')       as string,
    company:    formData.get('company')    as string,
    start_date: formData.get('start_date') as string,
    end_date:   isCurrent ? 'Present' : endDate,
    is_current: isCurrent,
    url:        (formData.get('url') as string) || '#',
    sort_order: nextOrder,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Update an existing experience ───────────────────────────────────────────
export async function updateExperience(id: string, formData: FormData) {
  const db      = await requireAdmin()
  const endDate = formData.get('end_date') as string
  const isCurrent = endDate === 'Present' || endDate.trim() === ''

  const { error } = await db
    .from('experience')
    .update({
      role:       formData.get('role')       as string,
      company:    formData.get('company')    as string,
      start_date: formData.get('start_date') as string,
      end_date:   isCurrent ? 'Present' : endDate,
      is_current: isCurrent,
      url:        (formData.get('url') as string) || '#',
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Delete an experience ─────────────────────────────────────────────────────
export async function deleteExperience(id: string) {
  const db = await requireAdmin()
  const { error } = await db.from('experience').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ─── Reorder experiences (drag-and-drop / move up-down) ──────────────────────
export async function reorderExperience(orderedIds: string[]) {
  const db = await requireAdmin()

  const updates = orderedIds.map((id, index) =>
    db.from('experience').update({ sort_order: index }).eq('id', id)
  )

  await Promise.all(updates)
  revalidatePath('/')
  return { success: true }
}

// ─── Swap sort_order between two experience entries ───────────────────────────
export async function swapExperienceOrder(id1: string, order1: number, id2: string, order2: number) {
  const db = await requireAdmin()
  await Promise.all([
    db.from('experience').update({ sort_order: order2 }).eq('id', id1),
    db.from('experience').update({ sort_order: order1 }).eq('id', id2),
  ])
  revalidatePath('/')
  return { success: true }
}
