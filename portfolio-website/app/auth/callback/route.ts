import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase OAuth callback.
 * Exchanges the one-time PKCE code and persists every auth cookie on the
 * redirect response so the following /admin request receives the session.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const rawNext = requestUrl.searchParams.get('next') ?? '/admin'

  // Only allow same-origin relative destinations.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : '/admin'

  const redirectToLogin = (reason: 'auth_failed' | 'unauthorized') => {
    const url = new URL('/admin/login', requestUrl.origin)
    url.searchParams.set('error', reason)
    return NextResponse.redirect(url)
  }

  if (!code) return redirectToLogin('auth_failed')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

  if (!supabaseUrl || !supabaseAnonKey || !adminEmail) {
    console.error('OAuth callback configuration is incomplete.')
    return redirectToLogin('auth_failed')
  }

  // Use the final redirect response as the cookie sink. This avoids losing
  // refreshed/session cookies when returning a NextResponse.redirect().
  const destination = new URL(next, requestUrl.origin)
  let response = NextResponse.redirect(destination)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    console.error('Supabase OAuth code exchange failed:', exchangeError.message)
    return redirectToLogin('auth_failed')
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email || user.email.trim().toLowerCase() !== adminEmail) {
    await supabase.auth.signOut()
    return redirectToLogin('unauthorized')
  }

  return response
}
