'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    setDark(!isLight)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    if (next) {
      // going dark — remove the light attribute; :root (dark) takes over
      document.documentElement.removeAttribute('data-theme')
      try { localStorage.removeItem('theme') } catch {}
    } else {
      // going light
      document.documentElement.setAttribute('data-theme', 'light')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }

  // Invisible placeholder — no layout shift, respects className for display
  if (dark === undefined) {
    return (
      <span
        className={className}
        style={{ width: 28, height: 28, flexShrink: 0 }}
        aria-hidden
      />
    )
  }

  return (
    <button
      onClick={toggle}
      // className controls display (hidden / inline-flex) — NO inline display override
      className={className}
      aria-label={dark ? 'Dark mode active — click for light' : 'Light mode active — click for dark'}
      title={dark ? 'Dark mode (click for light)' : 'Light mode (click for dark)'}
      style={{
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px solid var(--border)',
        backgroundColor: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'color 0.2s, background-color 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.color = '#FF4500'
        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
      }}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3"  />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"  y1="12" x2="3"  y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
