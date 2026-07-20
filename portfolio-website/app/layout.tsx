import type { Metadata } from 'next'
import './globals.css'
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider'
import data from '@/data/portfolio.json'
import { createClient } from '@/lib/supabase/server'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: data.meta.title,
  description: data.meta.description,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let faviconUrl: string | null = null
  try {
    const db = await createClient()
    const { data: profile } = await db.from('about_profile').select('favicon_url').single()
    faviconUrl = profile?.favicon_url ?? null
  } catch {}

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme'),a=location.pathname.startsWith('/admin');if(t==='dark'||a)document.documentElement.setAttribute('data-theme','dark');}catch(e){}`,
          }}
        />
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }}
      >
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
        <Analytics />
      </body>
    </html>
  )
}
