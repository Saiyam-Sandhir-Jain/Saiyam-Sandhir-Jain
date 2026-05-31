'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ResearchPaper, Patent, Certificate, LOR, Explorations as ExplorationsData } from '@/types/portfolio'
import { AskSamsButton } from '@/components/AskSamsButton'

// ─── Shared token colours ──────────────────────────────────────────────────
const ACCENT        = '#FF4500'
const CARD_BG       = 'var(--bg-card)'
const CARD_BORDER   = 'var(--border)'
const CARD_BORDER_H = 'rgba(255,69,0,0.25)'

// ─── Status badge colours ──────────────────────────────────────────────────
function statusConfig(status: string) {
  switch (status) {
    case 'published': return { label: 'Published', cls: 'status-badge-published' }
    case 'granted':   return { label: 'Granted',   cls: 'status-badge-granted' }
    case 'filed':     return { label: 'Filed',      cls: 'status-badge-filed' }
    case 'upcoming':
    default:          return { label: 'Upcoming',   cls: 'status-badge-upcoming' }
  }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status)
  return (
    <span className={`status-badge ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-heading font-semibold tracking-widest uppercase" style={{ color: ACCENT }}>
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(255,69,0,0.3), transparent)' }} />
    </div>
  )
}

// ─── Tag chip ─────────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-body"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      {label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Client Portal (fixes fixed-position modals inside transformed parents) ─
// ═══════════════════════════════════════════════════════════════════════════
function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Research Paper Card ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function PaperCard({ paper, onClick, className }: { paper: ResearchPaper; onClick: (p: ResearchPaper) => void; className?: string }) {
  return (
    <button
      onClick={() => onClick(paper)}
      className={cn(
        // overflow-hidden removed for the same reason as PatentCard — see note there.
        'bento-item group w-full text-left rounded-xl p-5 relative transition-all duration-300 cursor-pointer',
        className
      )}
      style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      {/* Hover border glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${CARD_BORDER_H}` }} />
      {/* Ambient accent */}
      <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'radial-gradient(ellipse at top right, rgba(255,69,0,0.08), transparent 70%)' }} />

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={paper.status} />
          <span className="text-zinc-500 text-[11px] font-body">{paper.year}</span>
        </div>
        <h3 className="font-heading font-semibold text-white text-sm leading-snug group-hover:text-zinc-100 transition-colors">{paper.title}</h3>
        <p className="text-zinc-500 text-xs font-body leading-relaxed line-clamp-1">{paper.venue}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {paper.tags.slice(0, 2).map(t => <Tag key={t} label={t} />)}
          {paper.tags.length > 2 && <Tag label={`+${paper.tags.length - 2}`} />}
        </div>
        <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110" style={{ backgroundColor: ACCENT }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </div>
      </div>
    </button>
  )
}

// ─── Research Paper Modal ─────────────────────────────────────────────────

export function PaperModal({ paper, onClose, onAskSams }: { paper: ResearchPaper | null; onClose: () => void; onAskSams?: (q: string) => void }) {
  useEffect(() => {
    if (!paper) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    document.body.style.overflow = 'hidden'
    // Push a dummy history entry so the mobile back button closes this modal
    history.pushState({ modal: 'paper' }, '')
    const handlePop = () => onClose()
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('keydown', handle)
      window.removeEventListener('popstate', handlePop)
      document.body.style.overflow = ''
      // If closing programmatically (not via back button), pop the dummy entry
      if (history.state?.modal === 'paper') history.back()
    }
  }, [paper, onClose])

  return (
    <ClientPortal>
      <AnimatePresence>
        {paper && (
          <>
            <motion.div
              key="paper-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="paper-modal"
              initial={{ y: '100%', opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[960px] mx-auto px-4 pb-4"
            >
              {/* ── overflow:clip clips to border-radius without creating a scroll container ── */}
              <div
                className="rounded-2xl relative flex flex-col"
                style={{ backgroundColor: CARD_BG, border: '1px solid var(--border)', maxHeight: 'min(88dvh, 88vh)', overflow: 'hidden' }}
              >
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full shrink-0" style={{ backgroundColor: 'var(--border)' }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 20% 100%, rgba(255,69,0,0.12) 0%, transparent 60%)' }} />

                {/* ── Scrollable body — overflowY:scroll + touchAction:pan-y = reliable on all browsers/devices ── */}
                <div
                  className="relative px-6 lg:px-8 pt-8 pb-4 flex-1 min-h-0"
                  style={{ overflowY: 'scroll', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase" style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}>Research Paper</span>
                        <StatusBadge status={paper.status} />
                      </div>
                      <h2 className="font-heading font-bold text-white text-xl lg:text-2xl tracking-tight leading-snug">{paper.title}</h2>
                      <p className="text-zinc-500 font-body text-xs mt-1">{paper.venue} · {paper.year}</p>
                      {paper.coAuthors && paper.coAuthors.length > 0 && (
                        <p className="text-zinc-600 font-body text-[11px] mt-0.5">Authors: {paper.coAuthors.join(', ')}</p>
                      )}
                    </div>
                    <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', touchAction: 'manipulation' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-2">Abstract</p>
                      <p className="text-zinc-300 text-sm leading-relaxed font-body">{paper.summary}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-3">Keywords & Stack</p>
                      <div className="flex flex-wrap gap-1.5">{paper.tags.map(t => <Tag key={t} label={t} />)}</div>
                    </div>
                  </div>
                </div>

                {/* ── Sticky CTA footer — always visible, never scrolls away ── */}
                <div className="shrink-0 flex flex-col gap-2 px-6 lg:px-8 pb-5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {/* View / Unavailable button + Ask Sams on same row */}
                  <div className="flex gap-2">
                    {paper.status === 'upcoming' ? (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm text-white cursor-not-allowed"
                        style={{ backgroundColor: ACCENT, opacity: 0.4 }}
                      >
                        Not Published Yet
                      </button>
                    ) : (
                      <a
                        href={paper.url !== '#' ? paper.url : undefined}
                        target="_blank" rel="noopener noreferrer"
                        onClick={paper.url === '#' ? e => e.preventDefault() : undefined}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm text-white transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                        style={{ backgroundColor: ACCENT, boxShadow: '0 4px 20px rgba(255,69,0,0.3)', cursor: paper.url === '#' ? 'not-allowed' : 'pointer', opacity: paper.url === '#' ? 0.7 : 1, touchAction: 'manipulation' }}
                      >
                        View
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                      </a>
                    )}
                    {onAskSams && (
                      <AskSamsButton
                        query={`Tell me about the research paper "${paper.title}"${paper.venue ? ` published at ${paper.venue}` : ''}.`}
                        onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                        variant="inline"
                      />
                    )}
                  </div>
                  <button onClick={onClose} className="flex-1 py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', touchAction: 'manipulation' }}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ClientPortal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Patent Card ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function PatentCard({ patent, onClick, className }: { patent: Patent; onClick: (p: Patent) => void; className?: string }) {
  return (
    <button
      onClick={() => onClick(patent)}
      className={cn(
        // overflow-hidden removed: the carousel container already has overflow-hidden for slide clipping.
        // Keeping it on the <button> itself triggers a Blink/WebKit border-paint bug — when the button
        // content is taller than the fixed height (e.g. a 3-line title), the browser incorrectly
        // includes the clipped region in the border calculation and swallows the bottom border.
        'bento-item group w-full text-left rounded-xl p-5 relative transition-all duration-300 cursor-pointer',
        className
      )}
      style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${CARD_BORDER_H}` }} />
      <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'radial-gradient(ellipse at top right, rgba(255,69,0,0.08), transparent 70%)' }} />

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={patent.status} />
          <span className="text-zinc-500 text-[11px] font-body">{patent.year}</span>
        </div>
        <h3 className="font-heading font-semibold text-white text-sm leading-snug group-hover:text-zinc-100 transition-colors">{patent.title}</h3>
        {patent.status !== 'upcoming' && (
          <div className="flex items-center gap-1.5 mt-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)' }} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span className="text-zinc-600 text-[10px] font-body font-mono">{patent.registrationNumber}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {patent.tags.slice(0, 2).map(t => <Tag key={t} label={t} />)}
          {patent.tags.length > 2 && <Tag label={`+${patent.tags.length - 2}`} />}
        </div>
        <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110" style={{ backgroundColor: ACCENT }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </div>
      </div>
    </button>
  )
}

// ─── Patent Modal ─────────────────────────────────────────────────────────

export function PatentModal({ patent, onClose, onAskSams }: { patent: Patent | null; onClose: () => void; onAskSams?: (q: string) => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!patent) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    document.body.style.overflow = 'hidden'
    // Push a dummy history entry so the mobile back button closes this modal
    history.pushState({ modal: 'patent' }, '')
    const handlePop = () => onClose()
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('keydown', handle)
      window.removeEventListener('popstate', handlePop)
      document.body.style.overflow = ''
      if (history.state?.modal === 'patent') history.back()
    }
  }, [patent, onClose])

  const handleCopy = async () => {
    if (!patent) return
    await navigator.clipboard.writeText(patent.registrationNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ClientPortal>
      <AnimatePresence>
        {patent && (
          <>
            <motion.div
              key="patent-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="patent-modal"
              initial={{ y: '100%', opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-[960px] mx-auto px-4 pb-4"
            >
              {/* ── overflow:clip clips to border-radius without creating a scroll container ── */}
              <div
                className="rounded-2xl relative flex flex-col"
                style={{ backgroundColor: CARD_BG, border: '1px solid var(--border)', maxHeight: 'min(88dvh, 88vh)', overflow: 'hidden' }}
              >
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full shrink-0" style={{ backgroundColor: 'var(--border)' }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 80% 100%, rgba(255,69,0,0.10) 0%, transparent 60%)' }} />

                {/* ── Scrollable body — overflowY:scroll + touchAction:pan-y = reliable on all browsers/devices ── */}
                <div
                  className="relative px-6 lg:px-8 pt-8 pb-4 flex-1 min-h-0"
                  style={{ overflowY: 'scroll', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase" style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}>Patent</span>
                        <StatusBadge status={patent.status} />
                      </div>
                      <h2 className="font-heading font-bold text-white text-xl lg:text-2xl tracking-tight leading-snug">{patent.title}</h2>
                      {patent.status !== 'upcoming' && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)' }} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          <span className="text-zinc-500 font-body text-xs font-mono">{patent.registrationNumber}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', touchAction: 'manipulation' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-2">Description</p>
                      <p className="text-zinc-300 text-sm leading-relaxed font-body">{patent.summary}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-3">Technology Stack</p>
                      <div className="flex flex-wrap gap-1.5">{patent.tags.map(t => <Tag key={t} label={t} />)}</div>
                    </div>
                  </div>
                </div>

                {/* ── Sticky CTA footer — always visible, never scrolls away ── */}
                <div className="shrink-0 flex flex-col gap-2 px-6 lg:px-8 pb-5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {/* Copy reg no / Unavailable + Ask Sams on same row */}
                  <div className="flex gap-2">
                    {patent.status === 'upcoming' ? (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm text-white cursor-not-allowed"
                        style={{ backgroundColor: '#FF4500', opacity: 0.4 }}
                      >
                        Not Filed Yet
                      </button>
                    ) : (
                      <button
                        onClick={handleCopy}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm text-white transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                        style={{ backgroundColor: copied ? 'rgba(34,197,94,0.85)' : ACCENT, boxShadow: copied ? '0 4px 20px rgba(34,197,94,0.25)' : '0 4px 20px rgba(255,69,0,0.3)', touchAction: 'manipulation' }}
                      >
                        {copied ? (
                          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                        ) : (
                          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Reg. No.</>
                        )}
                      </button>
                    )}
                    {onAskSams && (
                      <AskSamsButton
                        query={`Tell me about the patent "${patent.title}"${patent.registrationNumber ? ` (Reg. No. ${patent.registrationNumber})` : ''}.`}
                        onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                        variant="inline"
                      />
                    )}
                  </div>
                  <button onClick={onClose} className="flex-1 py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', touchAction: 'manipulation' }}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ClientPortal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Research Paper Vertical Carousel (Y-axis, one at a time) ─────────────
// ═══════════════════════════════════════════════════════════════════════════

function ResearchPaperCarousel({ papers, onPaperClick }: { papers: ResearchPaper[]; onPaperClick: (p: ResearchPaper) => void }) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(0)
  const isHoveringRef = useRef(false)

  function go(d: number) {
    setDir(d)
    setIndex(i => (i + d + papers.length) % papers.length)
  }

  function goTo(i: number) {
    if (i === index) return
    setDir(i > index ? 1 : -1)
    setIndex(i)
  }

  // Auto-scroll every 3.5 s, paused on hover
  useEffect(() => {
    if (papers.length <= 1) return
    const id = setInterval(() => {
      if (!isHoveringRef.current) {
        setDir(1)
        setIndex(i => (i + 1) % papers.length)
      }
    }, 3500)
    return () => clearInterval(id)
  }, [papers.length])

  const variants = {
    enter: (d: number) => ({ y: d > 0 ? '105%' : '-105%', opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (d: number) => ({ y: d > 0 ? '-105%' : '105%', opacity: 0 }),
  }

  const NavBtn = ({ dir: d, label }: { dir: number; label: string }) => (
    <button
      onClick={() => go(d)}
      aria-label={label}
      className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', touchAction: 'manipulation' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5">
        {d < 0
          ? <polyline points="18 15 12 9 6 15" />
          : <polyline points="6 9 12 15 18 9" />
        }
      </svg>
    </button>
  )

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onMouseEnter={() => { isHoveringRef.current = true }}
      onMouseLeave={() => { isHoveringRef.current = false }}
    >
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Research Papers</SectionLabel>
        {papers.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <NavBtn dir={-1} label="Previous paper" />
            <span className="text-zinc-600 text-[10px] font-mono w-6 text-center">{index + 1}/{papers.length}</span>
            <NavBtn dir={1} label="Next paper" />
          </div>
        )}
      </div>

      {/* Carousel container – Y axis; pb-px prevents overflow-hidden from clipping the card's bottom border */}
      <div className="relative overflow-hidden rounded-xl pb-px" style={{ height: '270px' }}>
        <AnimatePresence custom={dir} mode="wait" initial={false}>
          <motion.div
            key={index}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.35 }}
            className="absolute inset-0"
          >
            <PaperCard paper={papers[index]} onClick={onPaperClick} className="h-full" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      {papers.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {papers.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Paper ${i + 1}`}
              className="flex items-center justify-center w-5 h-5"
              style={{ touchAction: 'manipulation' }}
            >
              <span
                style={{
                  display: 'block',
                  width:  i === index ? '8px' : '5px',
                  height: i === index ? '8px' : '5px',
                  borderRadius: '50%',
                  backgroundColor: i === index ? ACCENT : 'var(--border)',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Patent Horizontal Carousel (X-axis, one at a time) ───────────────────
// ═══════════════════════════════════════════════════════════════════════════

function PatentCarousel({ patents, onPatentClick }: { patents: Patent[]; onPatentClick: (p: Patent) => void }) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(0)
  const isHoveringRef = useRef(false)

  function go(d: number) {
    setDir(d)
    setIndex(i => (i + d + patents.length) % patents.length)
  }

  function goTo(i: number) {
    if (i === index) return
    setDir(i > index ? 1 : -1)
    setIndex(i)
  }

  // Auto-scroll every 3.5 s, paused on hover (offset by 1.5 s so it alternates with papers)
  useEffect(() => {
    if (patents.length <= 1) return
    const id = setInterval(() => {
      if (!isHoveringRef.current) {
        setDir(1)
        setIndex(i => (i + 1) % patents.length)
      }
    }, 3500)
    return () => clearInterval(id)
  }, [patents.length])

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '105%' : '-105%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-105%' : '105%', opacity: 0 }),
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onMouseEnter={() => { isHoveringRef.current = true }}
      onMouseLeave={() => { isHoveringRef.current = false }}
    >
      <SectionLabel>Patents</SectionLabel>

      {/* Carousel row: [arrow] [card] [arrow] */}
      <div className="flex items-center gap-2 flex-1">
        {/* Left arrow */}
        {patents.length > 1 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous patent"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', touchAction: 'manipulation' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}

        {/* Card container – X axis */}
        <div className="relative overflow-hidden rounded-xl flex-1 pb-px" style={{ height: '248px' }}>
          <AnimatePresence custom={dir} mode="wait" initial={false}>
            <motion.div
              key={index}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.35 }}
              className="absolute inset-0"
            >
              <PatentCard patent={patents[index]} onClick={onPatentClick} className="h-full" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right arrow */}
        {patents.length > 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next patent"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', touchAction: 'manipulation' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>

      {/* Dots */}
      {patents.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {patents.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Patent ${i + 1}`}
              className="flex items-center justify-center w-5 h-5"
              style={{ touchAction: 'manipulation' }}
            >
              <span
                style={{
                  display: 'block',
                  width:  i === index ? '8px' : '5px',
                  height: i === index ? '8px' : '5px',
                  borderRadius: '50%',
                  backgroundColor: i === index ? ACCENT : 'var(--border)',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Certificate Card ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function CertCard({ cert, index, onClick }: { cert: Certificate; index: number; onClick: (c: Certificate) => void }) {
  const gradients = [
    'linear-gradient(135deg, rgba(255,69,0,0.25) 0%, rgba(120,30,0,0.4) 100%)',
    'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(55,48,163,0.4) 100%)',
    'linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(8,145,178,0.4) 100%)',
    'linear-gradient(135deg, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.4) 100%)',
    'linear-gradient(135deg, rgba(234,179,8,0.25) 0%, rgba(161,98,7,0.4) 100%)',
  ]
  const grad = gradients[index % gradients.length]

  return (
    <button
      onClick={() => onClick(cert)}
      className="group shrink-0 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer relative flex flex-col"
      style={{
        width: 'min(260px, 72vw)',
        height: '256px',
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        scrollSnapAlign: 'start',
      } as React.CSSProperties}
    >
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${CARD_BORDER_H}` }} />
      {/* Image preview — CSS background-image is immune to flex/absolute positioning
           quirks that caused the gradient bar to bleed through on alternate cards */}
      <div style={{ position: 'relative', width: '100%', height: '160px', flexShrink: 0, overflow: 'hidden' }}>
        {/* Image layer (covers fully) or gradient placeholder */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: cert.imageUrl
            ? `url("${cert.imageUrl}") center / cover no-repeat`
            : grad,
        }} />
        {/* No-image icon — only when imageUrl is absent */}
        {!cert.imageUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-60">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              <path d="M15 8l3-3M18 11l-3-3"/>
            </svg>
            <span className="text-white/50 text-[10px] font-heading uppercase tracking-widest">Certificate</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-heading font-semibold" style={{ backgroundColor: ACCENT }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </div>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-heading font-semibold text-white text-xs leading-snug line-clamp-2 mb-1">{cert.title}</h4>
        <p className="text-zinc-500 text-[11px] font-body line-clamp-1">{cert.issuer}</p>
        <p className="text-zinc-600 text-[10px] font-body mt-0.5">{cert.date}</p>
      </div>
    </button>
  )
}

// ─── Certificate Viewer (Lightbox) ─────────────────────────────────────────

function CertViewer({ cert, onClose, onAskSams }: { cert: Certificate | null; onClose: () => void; onAskSams?: (q: string) => void }) {
  useEffect(() => {
    if (!cert) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    document.body.style.overflow = 'hidden'
    history.pushState({ modal: 'cert' }, '')
    const handlePop = () => onClose()
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('keydown', handle)
      window.removeEventListener('popstate', handlePop)
      document.body.style.overflow = ''
      if (history.state?.modal === 'cert') history.back()
    }
  }, [cert, onClose])

  return (
    <ClientPortal>
      <AnimatePresence>
        {cert && (
          <>
            <motion.div key="cert-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }} />
            <motion.div
              key="cert-viewer"
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-2xl rounded-2xl overflow-hidden relative flex flex-col"
                style={{ backgroundColor: CARD_BG, border: '1px solid var(--border)', maxHeight: '90vh' }}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-1" style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}>Certificate</span>
                    <h3 className="font-heading font-semibold text-white text-sm leading-snug">{cert.title}</h3>
                    <p className="text-zinc-500 text-xs font-body">{cert.issuer} · {cert.date}</p>
                  </div>
                  <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="relative w-full flex items-center justify-center overflow-y-auto flex-1" style={{ background: 'rgba(0,0,0,0.3)', minHeight: '200px' }} onWheel={(e) => e.stopPropagation()}>
                  {cert.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cert.imageUrl} alt={cert.title} className="w-full h-auto max-h-[55vh] object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5">
                          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M15 8l3-3M18 11l-3-3"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-400 text-sm font-heading font-semibold">{cert.title}</p>
                        <p className="text-zinc-600 text-xs font-body mt-1">Certificate image will appear here once uploaded</p>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(255,69,0,0.08), transparent 60%)' }} />
                </div>
                <div className="px-5 py-3 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  {onAskSams && (
                    <AskSamsButton
                      query={`Tell me about the "${cert.title}" certificate from ${cert.issuer} on Saiyam's profile.`}
                      onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                      variant="fit"
                    />
                  )}
                  <button
                    onClick={onClose}
                    className="shrink-0 px-5 py-2 rounded-lg font-heading font-semibold text-xs text-zinc-400 transition-all duration-200 hover:text-white"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ClientPortal>
  )
}

// ─── Certificate Carousel ─────────────────────────────────────────────────

function CertificateCarousel({ certificates, onCertClick }: { certificates: Certificate[]; onCertClick: (c: Certificate) => void }) {
  const scrollRef    = useRef<HTMLDivElement>(null)
  const activeIdxRef = useRef(0)
  const [canLeft,      setCanLeft]      = useState(false)
  // ── Start with true so right arrow is visible before first measurement ──
  const [canRight,     setCanRight]     = useState(certificates.length > 1)
  const [activeIdx,    setActiveIdx]    = useState(0)
  // ── How many cards are visible at once (computed from layout) ──
  const [visibleCount, setVisibleCount] = useState(1)

  // ── Get card elements (exclude the trailing spacer) ──
  const getCards = useCallback(() => {
    const el = scrollRef.current
    if (!el) return []
    return Array.from(el.children).slice(0, certificates.length) as HTMLElement[]
  }, [certificates.length])

  // ── Get a card's scroll-relative offset using getBoundingClientRect ──
  // card.offsetLeft alone is unreliable because offsetParent may not be the
  // scroll container. getBoundingClientRect gives viewport-relative coords,
  // so subtracting the container's rect + adding scrollLeft gives true offset.
  const getCardOffset = useCallback((card: HTMLElement): number => {
    const el = scrollRef.current
    if (!el) return 0
    const elRect   = el.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    return cardRect.left - elRect.left + el.scrollLeft
  }, [])

  const updateState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const maxScroll = el.scrollWidth - el.clientWidth
    setCanLeft(el.scrollLeft > 2)
    // Use a small 2px threshold to avoid floating-point issues
    setCanRight(el.scrollLeft < maxScroll - 2)

    // Compute how many cards fit in the viewport (for page-based dots)
    const cards = getCards()
    if (cards.length > 0) {
      const cardW = cards[0].getBoundingClientRect().width
      const gap   = 12 // matches gap-3 (0.75rem = 12px)
      const containerW = el.clientWidth
      const count = Math.max(1, Math.round(containerW / (cardW + gap)))
      setVisibleCount(count)
    }

    // Find closest card to current scroll position using correct offsets
    if (cards.length === 0) return
    let closest = 0, minDist = Infinity
    cards.forEach((card, i) => {
      const cardOffset = getCardOffset(card)
      const dist = Math.abs(cardOffset - el.scrollLeft)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    activeIdxRef.current = closest
    setActiveIdx(closest)
  }, [getCards, getCardOffset])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateState, { passive: true })
    // ── Delay first measurement so layout is complete ──
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(updateState)
    })
    // Also listen for resize
    const ro = new ResizeObserver(() => requestAnimationFrame(updateState))
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateState)
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [updateState])

  // ── Scroll to a specific card index using getBoundingClientRect (reliable) ──
  function scrollToIdx(idx: number) {
    const el = scrollRef.current
    if (!el) return
    const cards = getCards()
    const card  = cards[idx]
    if (!card) return
    // Use the same getBoundingClientRect approach so scroll target matches dot tracking
    const targetOffset = getCardOffset(card)
    el.scrollTo({ left: targetOffset, behavior: 'smooth' })
  }

  function scrollBy(dir: number) {
    const cards  = getCards()
    const nextIdx = Math.max(0, Math.min(cards.length - 1, activeIdxRef.current + dir))
    scrollToIdx(nextIdx)
  }

  return (
    <div className="bento-item relative">
      {/* webkit scrollbar hiding — must be OUTSIDE the scroll container */}
      <style>{`.cert-scroll-hide::-webkit-scrollbar { display: none; }`}</style>

      {/* Left arrow */}
      <button
        onClick={() => scrollBy(-1)}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
          canLeft ? 'opacity-100 hover:scale-110' : 'opacity-0 pointer-events-none'
        )}
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', touchAction: 'manipulation' }}
        aria-label="Scroll left"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>

      {/* ── cert-scroll-hide class now applied so webkit rule above takes effect ── */}
      <div
        ref={scrollRef}
        className="cert-scroll-hide flex items-start gap-3 overflow-x-auto pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {certificates.map((cert, i) => (
          <CertCard key={cert.id} cert={cert} index={i} onClick={onCertClick} />
        ))}
        {/* Trailing spacer so last card snaps to start */}
        <div className="shrink-0 w-1" />
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy(1)}
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
          canRight ? 'opacity-100 hover:scale-110' : 'opacity-0 pointer-events-none'
        )}
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', touchAction: 'manipulation' }}
        aria-label="Scroll right"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── LOR PDF Viewer ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function LORViewer({ lor, onClose, onAskSams }: { lor: LOR | null; onClose: () => void; onAskSams?: (q: string) => void }) {
  useEffect(() => {
    if (!lor) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    document.body.style.overflow = 'hidden'
    history.pushState({ modal: 'lor' }, '')
    const handlePop = () => onClose()
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('keydown', handle)
      window.removeEventListener('popstate', handlePop)
      document.body.style.overflow = ''
      if (history.state?.modal === 'lor') history.back()
    }
  }, [lor, onClose])

  return (
    <ClientPortal>
      <AnimatePresence>
        {lor && (
          <>
            <motion.div
              key="lor-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
            />
            <motion.div
              key="lor-viewer"
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-2xl rounded-2xl overflow-hidden relative flex flex-col"
                style={{ backgroundColor: CARD_BG, border: '1px solid var(--border)', maxHeight: '90vh' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-1" style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}>
                      Letter of Recommendation
                    </span>
                    <h3 className="font-heading font-semibold text-white text-sm leading-snug truncate">{lor.recommender}</h3>
                    <p className="text-zinc-500 text-xs font-body">{lor.organization} · {lor.relationship}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="shrink-0 ml-4 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)', stroke: 'var(--text-muted)' }} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* PDF area */}
                <div className="relative flex-1 flex items-center justify-center overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', minHeight: '240px' }}>
                  {lor.pdfUrl ? (
                    <iframe
                      src={lor.pdfUrl}
                      className="w-full flex-1"
                      style={{ height: '55vh', border: 'none' }}
                      title={`LOR from ${lor.recommender}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                      </div>
                      <div className="text-center px-4">
                        <p className="text-zinc-400 text-sm font-heading font-semibold">{lor.recommender}</p>
                        <p className="text-zinc-600 text-xs font-body mt-1">PDF will appear here once uploaded</p>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(255,69,0,0.06), transparent 60%)' }} />
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  {onAskSams && (
                    <AskSamsButton
                      query={`Tell me about the letter of recommendation for Saiyam from ${lor.recommender} at ${lor.organization}.`}
                      onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                      variant="fit"
                    />
                  )}
                  <button
                    onClick={onClose}
                    className="shrink-0 px-5 py-2 rounded-lg font-heading font-semibold text-xs text-zinc-400 transition-all duration-200 hover:text-white"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ClientPortal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── LOR Card (clickable, no badge) ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function LORCard({ lor, onClick }: { lor: LOR; onClick: (l: LOR) => void }) {
  return (
    <button
      onClick={() => onClick(lor)}
      className="bento-item group w-full text-left rounded-xl p-4 relative overflow-hidden transition-all duration-300 cursor-pointer"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      {/* Hover glow border */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${CARD_BORDER_H}` }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(255,69,0,0.04), transparent 70%)' }} />

      <div className="relative flex items-start gap-3">
        {/* Avatar initial */}
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,69,0,0.12)', border: '1px solid rgba(255,69,0,0.18)' }}>
          <span className="font-heading font-bold text-xs" style={{ color: ACCENT }}>{lor.recommender.charAt(0)}</span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h4 className="font-heading font-semibold text-white text-sm truncate group-hover:text-zinc-100 transition-colors">{lor.recommender}</h4>
          <p className="text-zinc-500 text-[11px] font-body mt-0.5 truncate">{lor.organization}</p>
          <p className="text-zinc-600 text-[10px] font-body mt-0.5">{lor.relationship}</p>
        </div>

        {/* PDF icon — shows on hover */}
        <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Anime.js animated wrapper ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function AnimeSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('.bento-item'))
    const targets = items.length > 0 ? items : [el]

    targets.forEach(t => {
      t.style.opacity    = '0'
      t.style.transform  = 'translateY(18px) scale(0.96)'
      t.style.willChange = 'transform, opacity'
    })

    const obs = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !fired.current) {
        fired.current = true
        obs.disconnect()
        try {
          const mod   = await import('animejs')
          const anime = (mod.default ?? mod) as any
          anime({
            targets,
            opacity:    [0, 1],
            translateY: [18, 0],
            scale:      [0.96, 1],
            delay:      anime.stagger(70, { start: delay }),
            easing:     'easeOutElastic(1, .8)',
            duration:   800,
            complete:   () => targets.forEach(t => { t.style.willChange = 'auto' }),
          })
        } catch {
          targets.forEach((t, i) => {
            t.style.transition = `opacity 0.45s ease ${i * 70 + delay}ms, transform 0.45s ease ${i * 70 + delay}ms`
            t.style.opacity    = '1'
            t.style.transform  = 'translateY(0) scale(1)'
          })
        }
      }
    }, { threshold: 0.06 })

    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])

  return <div ref={ref} className={className}>{children}</div>
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Explorations View ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function Explorations({ data, onAskSams }: { data: ExplorationsData; onAskSams?: (q: string) => void }) {
  const [selectedPaper,  setPaper]  = useState<ResearchPaper | null>(null)
  const [selectedPatent, setPatent] = useState<Patent | null>(null)
  const [selectedCert,   setCert]   = useState<Certificate | null>(null)
  const [selectedLOR,    setLOR]    = useState<LOR | null>(null)

  return (
    <>
      {/* ── pt-24 matches HomeView; pb-4 leaves consistent bottom padding ── */}
      <div className="max-w-[820px] mx-auto px-4 pt-24 pb-0 space-y-3">

        {/* ── Research Papers + Patents side by side (desktop carousel) ── */}
        <AnimeSection delay={40}>

          {/* Desktop: side-by-side carousels */}
          <div className="hidden md:flex gap-3 items-stretch">

            {/* Research Paper tile – narrower (~40%) */}
            <div className="flex flex-col" style={{ width: '41%' }}>
              <div
                className="bento-item rounded-xl p-5 lg:p-6 flex flex-col flex-1"
                style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
              >
                <ResearchPaperCarousel papers={data.papers} onPaperClick={setPaper} />
              </div>
            </div>

            {/* Patent tile – wider (~59%) */}
            <div className="flex flex-col" style={{ width: '59%' }}>
              <div
                className="bento-item rounded-xl p-5 lg:p-6 flex flex-col flex-1"
                style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
              >
                <PatentCarousel patents={data.patents} onPatentClick={setPatent} />
              </div>
            </div>
          </div>

          {/* Mobile: normal stacked grid */}
          <div className="md:hidden space-y-3">
            <div className="bento-item rounded-xl p-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <SectionLabel>Research Papers</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {data.papers.map(paper => <PaperCard key={paper.id} paper={paper} onClick={setPaper} />)}
              </div>
            </div>
            <div className="bento-item rounded-xl p-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <SectionLabel>Patents</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {data.patents.map(patent => <PatentCard key={patent.id} patent={patent} onClick={setPatent} />)}
              </div>
            </div>
          </div>
        </AnimeSection>

        {/* ── Certificates Carousel ── */}
        <AnimeSection delay={80}>
          <div className="rounded-xl p-5 lg:p-6 relative overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <SectionLabel>Certifications</SectionLabel>
            <CertificateCarousel certificates={data.certificates} onCertClick={setCert} />
          </div>
        </AnimeSection>

        {/* ── LORs ── */}
        <AnimeSection delay={120}>
          <div className="rounded-xl p-5 lg:p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <SectionLabel>Letters of Recommendation</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.lors.map(lor => <LORCard key={lor.id} lor={lor} onClick={setLOR} />)}
            </div>
          </div>
        </AnimeSection>

      </div>

      {/* ── Modals — portaled to document.body (fixed position always works) ── */}
      <PaperModal  paper={selectedPaper}   onClose={() => setPaper(null)}   onAskSams={onAskSams} />
      <PatentModal patent={selectedPatent} onClose={() => setPatent(null)}  onAskSams={onAskSams} />
      <CertViewer  cert={selectedCert}     onClose={() => setCert(null)}  onAskSams={onAskSams} />
      <LORViewer   lor={selectedLOR}       onClose={() => setLOR(null)}   onAskSams={onAskSams} />
    </>
  )
}
