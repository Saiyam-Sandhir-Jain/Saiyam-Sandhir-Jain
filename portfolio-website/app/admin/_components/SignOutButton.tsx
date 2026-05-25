'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
    >
      Sign Out
    </button>
  )
}
