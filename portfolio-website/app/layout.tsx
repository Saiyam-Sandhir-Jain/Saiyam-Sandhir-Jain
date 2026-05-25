import type { Metadata } from 'next'
import './globals.css'
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider'
import data from '@/data/portfolio.json'

export const metadata: Metadata = {
  title: data.meta.title,
  description: data.meta.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{
          backgroundColor: '#161616',
          color: '#fafafa',
          fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
        }}
      >
        {/*
          SmoothScrollProvider wraps the app for Lenis smooth scrolling.
          NoiseOverlay removed — it was unused and not exported anywhere.
        */}
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  )
}
