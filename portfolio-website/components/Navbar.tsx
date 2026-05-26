'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types/portfolio'

export type ViewId = 'home' | 'projects' | 'explorations'

interface NavbarProps {
  navigation:     NavItem[]
  currentView:    ViewId
  onViewChange:   (view: ViewId) => void
  onAnchorClick?: (anchor: string) => void
  /** Agent chat toggle */
  onAgentToggle?: () => void
  agentOpen?:     boolean
}

export function Navbar({ navigation, currentView, onViewChange, onAnchorClick, onAgentToggle, agentOpen }: NavbarProps) {
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [navShown, setNavShown]   = useState(true)   // hide on scroll-down, reveal on scroll-up (all viewports)
  const lastScrollY               = { current: 0 }

  useEffect(() => {
    const onScroll = () => {
      const currentY  = window.scrollY

      setScrolled(currentY > 20)

      if (currentY < 60) {
        // Always show near the top — all screen sizes
        setNavShown(true)
      } else if (currentY > lastScrollY.current + 4) {
        // Scrolling DOWN — hide (4 px dead-zone prevents micro-jitter) — all screen sizes
        setNavShown(false)
        if (window.innerWidth < 768) setMenuOpen(false) // also collapse open mobile menu
      } else if (currentY < lastScrollY.current - 4) {
        // Scrolling UP — reveal — all screen sizes
        setNavShown(true)
      }

      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menu on outside click
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
          scrolled ? 'shadow-xl shadow-black/40' : 'shadow-lg shadow-black/20'
        )}
        style={{
          backgroundColor: 'rgba(28,26,24,0.88)',
          borderColor: 'rgba(255,255,255,0.09)',
        }}
      >
        {/* Logo — "SJ" monogram — clicks toggle the Sams AI agent */}
        <button
          onClick={() => { setMenuOpen(false); onAgentToggle?.() }}
          className="flex items-center justify-center shrink-0 select-none relative"
          aria-label="Toggle Sams AI chat"
          aria-expanded={agentOpen}
        >
          {/* Blinking diamond badge — always visible, signals AI is available */}
          <span
            className="absolute -top-1.5 -right-1.5 text-[8px] leading-none pointer-events-none"
            style={{
              color:     '#FF4500',
              animation: 'sj-diamond-blink 2s ease-in-out infinite',
            }}
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

        {/* Diamond blink keyframes — injected once with the navbar */}
        <style>{`
          @keyframes sj-diamond-blink {
            0%, 100% { opacity: 1;   transform: scale(1);    }
            50%       { opacity: 0.3; transform: scale(0.75); }
          }
        `}</style>

        {/* Vertical divider — desktop only, between SJ and nav links */}
        <div
          className="hidden md:block shrink-0 self-stretch w-px mx-3"
          style={{ background: 'rgba(255,255,255,0.10)' }}
        />

        {/* ── Mobile centre label — current page/section — tap to open menu ── */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden flex-1 text-center text-xs font-heading font-semibold tracking-widest uppercase transition-colors duration-200 select-none"
          style={{ color: menuOpen ? '#FF4500' : 'rgba(212,212,216,1)' }}
          aria-label="Open navigation menu"
        >
          {navigation.find(item => isActive(item))?.label ?? 'About'}
        </button>

        {/* ── Desktop nav links (md+) — equidistant fill ── */}
        <ul className="hidden md:flex items-center flex-1 justify-around">
          {navigation.map(item => (
            <li key={item.href} className="flex-1 flex justify-center">
              <button
                onClick={() => handleNavClick(item)}
                className={cn(
                  'w-full px-2 py-1.5 rounded-lg text-xs font-heading font-semibold tracking-widest uppercase',
                  'transition-all duration-200',
                  isActive(item) ? 'text-[#FF4500]' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        {/* ── Hamburger button (below md) — no ml-auto so flex-1 label stays truly centred ── */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={cn(
            'md:hidden shrink-0 flex flex-col justify-center items-center gap-[5px]',
            'w-8 h-8 rounded-lg transition-all duration-200',
            'hover:bg-white/5 active:scale-95'
          )}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span
            className={cn(
              'block w-4 h-[1.5px] rounded-full transition-all duration-300 origin-center',
              menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''
            )}
            style={{ backgroundColor: menuOpen ? '#FF4500' : 'rgba(255,255,255,0.7)' }}
          />
          <span
            className={cn(
              'block w-4 h-[1.5px] rounded-full transition-all duration-300',
              menuOpen ? 'opacity-0 scale-x-0' : ''
            )}
            style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
          />
          <span
            className={cn(
              'block w-4 h-[1.5px] rounded-full transition-all duration-300 origin-center',
              menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''
            )}
            style={{ backgroundColor: menuOpen ? '#FF4500' : 'rgba(255,255,255,0.7)' }}
          />
        </button>
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
          backgroundColor: 'rgba(28,26,24,0.96)',
          borderColor: 'rgba(255,255,255,0.09)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        {navigation.map((item, i) => (
          <button
            key={item.href}
            onClick={() => handleNavClick(item)}
            className={cn(
              'w-full text-left px-5 py-3.5 text-xs font-heading font-semibold tracking-widest uppercase',
              'transition-colors duration-150 flex items-center gap-3',
              i < navigation.length - 1 ? 'border-b' : '',
              isActive(item) ? 'text-[#FF4500]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            )}
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
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
