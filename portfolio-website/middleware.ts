import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Supabase falls back to its configured Site URL when the requested
  // redirectTo URL is not on its Redirect URLs allowlist. If that fallback
  // lands on '/', forward the one-time code to our real callback handler.
  if (pathname === '/' && searchParams.has('code')) {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = '/auth/callback'
    callbackUrl.searchParams.set('next', '/admin')
    return NextResponse.redirect(callbackUrl)
  }

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

  const loginUrl = new URL('/admin/login', request.url)
  if (!supabaseUrl || !supabaseAnonKey || !adminEmail) {
    loginUrl.searchParams.set('error', 'auth_failed')
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // getUser() validates the JWT with Supabase; do not trust getSession() here.
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.redirect(loginUrl)

  if (!user.email || user.email.trim().toLowerCase() !== adminEmail) {
    await supabase.auth.signOut()
    loginUrl.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/admin/:path*'],
}
