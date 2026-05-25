'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from './guard'

// ─── Update a single skill tile (by slot: 1, 2, or 3) ────────────────────────
export async function updateSkill(
  slot: 1 | 2 | 3,
  category: string,
  tags: string[]
) {
  const db = await requireAdmin()

  const { error } = await db
    .from('skills')
    .update({
      category,
      tags,
      updated_at: new Date().toISOString(),
    })
    .eq('slot', slot)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}
