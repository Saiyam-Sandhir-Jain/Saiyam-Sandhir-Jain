'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Verifies the current session belongs to the admin email.
 * Throws if not authenticated or not authorized.
 * Returns the service-role Supabase client for DB writes.
 */
export async function requireAdmin() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (session.user.email !== adminEmail) {
    throw new Error('Not authorized')
  }

  // Service role client bypasses RLS — safe because we've verified the caller
  return createServiceClient()
}
