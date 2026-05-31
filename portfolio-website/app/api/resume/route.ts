/**
 * app/api/resume/route.ts
 *
 * Why this exists:
 *   The portfolio page (page.tsx) is a Next.js Server Component whose HTML is
 *   cached by ISR / Vercel's edge. When the admin uploads a new resume.pdf the
 *   `revalidatePath('/')` call marks the page stale, but the old HTML (with the
 *   old ?t= timestamp baked in) can still be served until the next background
 *   revalidation cycle. Supabase's CDN also caches the PDF response keyed to
 *   that full URL including the old timestamp, so users on the old HTML can end
 *   up fetching the old cached PDF even though the file on storage was replaced.
 *
 *   By pointing the résumé button at `/api/resume` instead of the raw Supabase
 *   URL, every click goes through this force-dynamic route which:
 *     1. Reads the current `resume_url` + `updated_at` fresh from Supabase.
 *     2. Rebuilds the URL using `updated_at` as the cache-buster (always
 *        matches the most recent upload, regardless of what HTML the browser has).
 *     3. Redirects with Cache-Control: no-store so the browser never caches
 *        this redirect response itself.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

// Never cache this route — always hit the DB for the latest resume URL
export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createClient()

  const { data, error } = await db
    .from('about_profile')
    .select('resume_url, updated_at')
    .single()

  if (error || !data?.resume_url) {
    return NextResponse.json(
      { error: 'Resume not found' },
      { status: 404 }
    )
  }

  // Strip any stale ?t= param that may have been stored at upload time,
  // then re-append using updated_at so the URL is always current.
  const base      = data.resume_url.split('?')[0]
  const version   = new Date(data.updated_at).getTime()
  const freshUrl  = `${base}?t=${version}`

  return NextResponse.redirect(freshUrl, {
    status: 302,
    headers: {
      // Prevent the browser from caching this redirect — so the next
      // click always comes back here for a fresh lookup.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
