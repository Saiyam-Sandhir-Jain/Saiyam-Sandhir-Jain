import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth callback handler.
 * Supabase redirects here after Google login with a one-time `code`.
 * We exchange it for a session, then enforce the admin-email allowlist.
 *
 * On Vercel, request.url resolves to an internal hostname — we use
 * x-forwarded-host to get the real public domain instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  // On Vercel the reverse proxy sets x-forwarded-host to the real public domain.
  // Using `origin` alone resolves to an internal URL and breaks the redirect.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const publicOrigin =
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
      const { data: { session } } = await supabase.auth.getSession()
      const adminEmail = process.env.ADMIN_EMAIL

      if (session?.user?.email !== adminEmail) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${publicOrigin}/admin/login?error=unauthorized`)
      }

      return NextResponse.redirect(`${publicOrigin}${next}`)
    }
  }

  return NextResponse.redirect(`${publicOrigin}/admin/login?error=auth_failed`)
}
