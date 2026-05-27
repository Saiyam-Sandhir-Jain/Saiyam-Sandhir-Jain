'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { NavItem } from '@/types/portfolio'

export type ViewId = 'home' | 'projects' | 'explorations'

interface NavbarProps {
  navigation:     NavItem[]
  currentView:    ViewId
  onViewChange:   (view: ViewId) => void
  onAnchorClick?: (anchor: string) => void
  onAgentToggle?: () => void
  agentOpen?:     boolean
}

export function Navbar({ navigation, currentView, onViewChange, onAnchorClick, onAgentToggle, agentOpen }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navShown, setNavShown] = useState(true)
  const lastScrollY = { current: 0 }

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY
      setScrolled(currentY > 20)
      if (currentY < 60) {
        setNavShown(true)
      } else if (currentY > lastScrollY.current + 4) {
        setNavShown(false)
        if (window.innerWidth < 768) setMenuOpen(false)
      } else if (currentY < lastScrollY.current - 4) {
        setNavShown(true)
      }
      lastScrollY.current = currentY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-nav]')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  function handleNavClick(item: NavItem) {
    setMenuOpen(false)
    const href = item.href
    if (href === '/projects' || item.label === 'Projects') {
      onViewChange('projects')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (href === '#about' || item.label === 'About') {
      onViewChange('home')
      setTimeout(() => {
        const el = document.getElementById('about')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } else if (href === '#research' || item.label === 'Explorations') {
      onViewChange('explorations')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onViewChange('home')
    }
  }

  function isActive(item: NavItem): boolean {
    if (item.href === '/projects' || item.label === 'Projects') return currentView === 'projects'
    if (item.href === '#about'    || item.label === 'About')    return currentView === 'home'
    if (item.label === 'Explorations') return currentView === 'explorations'
    return currentView === 'home'
  }

  const activeLabel = navigation.find(item => isActive(item))?.label ?? 'About'

  return (
    <nav
      data-nav
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-[820px] px-4"
      style={{
        transform: `translateX(-50%) translateY(${navShown ? '0' : 'calc(-100% - 24px)'})`,
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Main pill bar ── */}
      <div
        className={cn(
          'flex items-center px-5 py-2.5 rounded-xl',
          'border backdrop-blur-md transition-all duration-300',
          scrolled ? 'shadow-xl shadow-black/20' : 'shadow-lg shadow-black/10'
        )}
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderColor: 'var(--nav-border)',
        }}
      >
        {/* SJ logo — toggles Sams AI */}
        <button
          onClick={() => { setMenuOpen(false); onAgentToggle?.() }}
          className="flex items-center justify-center shrink-0 select-none relative"
          aria-label="Toggle Sams AI chat"
          aria-expanded={agentOpen}
        >
          <span
            className="absolute -top-1.5 -right-1.5 text-[8px] leading-none pointer-events-none"
            style={{ color: '#FF4500', animation: 'sj-diamond-blink 2s ease-in-out infinite' }}
          >
            ✦
          </span>
          <span
            className="font-heading font-bold text-sm leading-none tracking-tight"
            style={{ color: agentOpen ? '#ff6a33' : '#FF4500' }}
          >
            SJ
          </span>
        </button>

        <style>{`
          @keyframes sj-diamond-blink {
            0%, 100% { opacity: 1;   transform: scale(1);    }
            50%       { opacity: 0.3; transform: scale(0.75); }
          }
        `}</style>

        {/* Vertical divider — desktop only */}
        <div
          className="hidden md:block shrink-0 self-stretch w-px mx-3"
          style={{ background: 'var(--border)' }}
        />

        {/* ── Mobile: centre label + chevron toggle ── */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden flex-1 flex items-center justify-center gap-1.5 select-none"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
        >
          <span
            className="text-xs font-heading font-semibold tracking-widest uppercase transition-colors duration-200"
            style={{ color: menuOpen ? '#FF4500' : 'var(--text-secondary)' }}
          >
            {activeLabel}
          </span>
          {/* Chevron — rotates up when open */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: menuOpen ? '#FF4500' : 'var(--text-muted)',
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease, color 0.2s',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* ── Desktop nav links (md+) ── */}
        <ul className="hidden md:flex items-center flex-1 justify-around">
          {navigation.map(item => (
            <li key={item.href} className="flex-1 flex justify-center">
              <button
                onClick={() => handleNavClick(item)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-heading font-semibold tracking-widest uppercase transition-all duration-200"
                style={{ color: isActive(item) ? '#FF4500' : 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!isActive(item)) (e.currentTarget as HTMLButtonElement).style.color = '#FF4500' }}
                onMouseLeave={e => { if (!isActive(item)) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Desktop: divider + theme toggle */}
        <div
          className="hidden md:block shrink-0 self-stretch w-px mx-3"
          style={{ background: 'var(--border)' }}
        />
        <ThemeToggle className="hidden md:inline-flex" />

        {/* ── Mobile right side: ThemeToggle replaces hamburger ── */}
        <ThemeToggle className="inline-flex md:hidden" />
      </div>

      {/* ── Mobile dropdown menu ── */}
      <div
        className={cn(
          'md:hidden mt-2 rounded-xl border backdrop-blur-md overflow-hidden',
          'transition-all duration-300 ease-out',
          menuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderColor: 'var(--nav-border)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
        }}
      >
        {navigation.map((item, i) => (
          <button
            key={item.href}
            onClick={() => handleNavClick(item)}
            className={cn(
              'w-full text-left px-5 py-3.5 text-xs font-heading font-semibold tracking-widest uppercase',
              'transition-colors duration-150 flex items-center gap-3',
              i < navigation.length - 1 && 'border-b'
            )}
            style={{
              borderColor: 'var(--border-subtle)',
              color: isActive(item) ? '#FF4500' : 'var(--text-secondary)',
            }}
          >
            {isActive(item) && (
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: '#FF4500' }} />
            )}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
