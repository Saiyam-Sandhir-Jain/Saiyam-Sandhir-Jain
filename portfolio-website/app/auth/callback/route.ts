import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth callback handler.
 * Supabase redirects here after Google login with a one-time `code`.
 * We exchange it for a session, then enforce the admin-email allowlist.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // ── Validate `next` to prevent open-redirect attacks ──────────────────────
  // Only allow relative paths that start with a single slash (not `//evil.com`).
  const rawNext = searchParams.get('next') ?? '/admin'
  const next    = rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : '/admin'

  // On Vercel the reverse proxy sets x-forwarded-host to the real public domain.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const publicOrigin  =
    process.env.NODE_ENV === 'production' && forwardedHost
      ? `https://${forwardedHost}`
      : origin

  if (code) {
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Use getUser() for authoritative JWT validation
      const { data: { user } } = await supabase.auth.getUser()
      const adminEmail = process.env.ADMIN_EMAIL

      if (user?.email !== adminEmail) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${publicOrigin}/admin/login?error=unauthorized`)
      }

      return NextResponse.redirect(`${publicOrigin}${next}`)
    }
  }

  return NextResponse.redirect(`${publicOrigin}/admin/login?error=auth_failed`)
}
