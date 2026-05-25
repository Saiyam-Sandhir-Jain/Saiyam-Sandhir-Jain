import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Only run on /admin routes ──────────────────────────────────────────────
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // ── Always allow the login page and auth callback ──────────────────────────
  if (pathname === '/admin/login' || pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // ── Build a response we can mutate (to forward refreshed cookies) ──────────
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // ── Create Supabase client that reads/writes cookies on the request ────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Forward the refreshed cookie to both the request and response
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // ── Get the current session ────────────────────────────────────────────────
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const loginUrl = new URL('/admin/login', request.url)

  // Not authenticated → redirect to login
  if (!session) {
    return NextResponse.redirect(loginUrl)
  }

  // Wrong email → sign out + redirect with error
  const adminEmail = process.env.ADMIN_EMAIL
  if (session.user.email !== adminEmail) {
    await supabase.auth.signOut()
    loginUrl.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated + authorized — let through ───────────────────────────────
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
