'use client'

import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
      <div
        className="w-full max-w-sm p-8 rounded-xl"
        style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <h1 className="text-white text-xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-zinc-400 text-sm mb-6">Portfolio Admin</p>

        {error === 'unauthorized' && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            Access denied. Only the authorised admin email can log in.
          </div>
        )}
        {error === 'auth_failed' && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            Authentication failed. Please try again.
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors"
        >
          {/* Google SVG icon */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-4 text-zinc-600 text-xs text-center">
          Access restricted to the authorised admin account.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#161616' }} />}>
      <LoginContent />
    </Suspense>
  )
}
