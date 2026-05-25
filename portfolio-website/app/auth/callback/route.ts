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
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/admin'

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
      // Verify the signed-in email matches the ADMIN_EMAIL allowlist
      const { data: { session } } = await supabase.auth.getSession()
      const adminEmail = process.env.ADMIN_EMAIL

      if (session?.user?.email !== adminEmail) {
        // Sign out the unauthorized user immediately
        await supabase.auth.signOut()
        return NextResponse.redirect(
          `${origin}/admin/login?error=unauthorized`
        )
      }

      // Success — redirect to admin dashboard (or wherever next points)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Exchange failed or no code provided
  return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
}
