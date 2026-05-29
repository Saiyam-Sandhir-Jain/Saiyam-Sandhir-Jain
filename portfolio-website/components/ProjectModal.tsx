'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Project } from '@/types/portfolio'
import { AskSamsButton } from '@/components/AskSamsButton'

interface ProjectModalProps {
  project:     Project | null
  onClose:     () => void
  onAskSams?:  (query: string) => void
}

export function ProjectModal({ project, onClose, onAskSams }: ProjectModalProps) {
  useEffect(() => {
    if (!project) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    // Push a dummy history entry so the mobile back button closes this modal
    history.pushState({ modal: 'project' }, '')
    const handlePop = () => onClose()
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('popstate', handlePop)
      document.body.style.overflow = ''
      if (history.state?.modal === 'project') history.back()
    }
  }, [project, onClose])

  const typeLabel = project?.type === 'tall' ? 'Mobile App' : project?.label || 'Project'

  const title       = project?.modalHeading    || project?.title       || ''
  const subtitle    = project?.modalSubheading || project?.description || ''
  const abstract    = project?.modalAbstract   || project?.description || ''
  const tags        = project?.modalTags       ?? []
  const links       = project?.modalLinks      ?? []
  const primaryLink = links[0] ?? (project?.url && project.url !== '#' ? { label: 'View', url: project.url } : null)

  const isResearch = project?.subtype === 'research'
  const isPatent   = project?.subtype === 'patent'
  const isUpcoming = project?.modalStatus === 'upcoming'

  const viewDisabled   = isResearch && isUpcoming
  const patentDisabled = isPatent && isUpcoming
  const primaryDisabled = viewDisabled || patentDisabled

  // Build the Ask Sams query from available project info
  const samsQuery = project
    ? isResearch
      ? `Tell me about the research paper "${title}"${subtitle ? ` — ${subtitle}` : ''}.`
      : isPatent
        ? `Tell me about the patent "${title}"${subtitle ? ` — ${subtitle}` : ''}.`
        : `Tell me about the project "${title}"${subtitle ? ` — ${subtitle}` : ''}.`
    : ''

  // Secondary links (links[1]...) — split first secondary vs rest so we can pair it with Ask Sams
  const secondaryLinks = links.slice(1)

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
          />

          {/* Drawer — bottom sheet on all sizes */}
          <motion.div
            key="modal"
            initial={{ y: '100%', opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[960px] mx-auto px-4 pb-4"
          >
            {/* Card — flex column so inner parts can be fixed/scrollable */}
            <div
              className="rounded-2xl relative flex flex-col overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                maxHeight: 'min(90dvh, 680px)',
              }}
            >
              {/* Ambient glow — pointer-events-none, won't interfere */}
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{ background: 'radial-gradient(ellipse 60% 80% at 20% 100%, rgba(255,69,0,0.10) 0%, transparent 60%)' }}
              />

              {/* Drag handle */}
              <div
                className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full z-10 shrink-0"
                style={{ backgroundColor: 'var(--border)' }}
              />

              {/* ── Scrollable content area ── */}
              <div
                className="relative z-10 flex-1 overflow-y-auto pt-8 px-6 lg:px-8 pb-4"
                style={{ overscrollBehavior: 'contain' }}
                onWheel={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-2"
                      style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}
                    >
                      {typeLabel}
                    </span>

                    {isUpcoming && (isResearch || isPatent) && (
                      <span
                        className="inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-2"
                        style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
                      >
                        Upcoming
                      </span>
                    )}

                    <h2 className="font-heading font-bold text-2xl lg:text-3xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {title}
                    </h2>
                    <p className="font-body text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                  </div>

                  <button
                    onClick={onClose}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)' }} strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                  >
                    <p className="text-xs font-heading uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>About this project</p>
                    <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
                      {abstract || `${subtitle}. More details coming soon.`}
                    </p>
                  </div>

                  {tags.length > 0 && (
                    <div
                      className="rounded-xl p-4"
                      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                    >
                      <p className="text-xs font-heading uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Stack / Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[11px] font-body"
                            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Sticky button footer ── */}
              <div
                className="relative z-10 shrink-0 flex flex-col gap-2 px-6 lg:px-8 pb-5 pt-3 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {/* Primary action */}
                {primaryLink && !primaryDisabled ? (
                  <a
                    href={primaryLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                    style={{ backgroundColor: '#FF4500', color: '#fff', boxShadow: '0 4px 20px rgba(255,69,0,0.3)' }}
                  >
                    {primaryLink.label}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                    </svg>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-heading font-semibold text-sm cursor-not-allowed"
                    style={{ backgroundColor: '#FF4500', color: '#fff', opacity: 0.4 }}
                  >
                    {isUpcoming ? (isResearch ? 'Not Published Yet' : 'Not Filed Yet') : (primaryLink?.label ?? 'Link Coming Soon')}
                  </button>
                )}

                {/* Secondary links — first one shares a row with Ask Sams button */}
                {secondaryLinks.length > 0 && (
                  <div className="flex gap-2">
                    <a
                      href={secondaryLinks[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200 text-center hover:scale-[1.02]"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {secondaryLinks[0].label}
                    </a>
                    {onAskSams && (
                      <AskSamsButton
                        query={samsQuery}
                        onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                        variant="inline"
                      />
                    )}
                  </div>
                )}

                {/* Any remaining secondary links (3rd, 4th…) */}
                {secondaryLinks.slice(1).map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200 text-center hover:scale-[1.02]"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {link.label}
                  </a>
                ))}

                {/* If no secondary links, Ask Sams goes full-width above Close */}
                {secondaryLinks.length === 0 && onAskSams && (
                  <AskSamsButton
                    query={samsQuery}
                    onAsk={(q) => { onClose(); setTimeout(() => onAskSams(q), 180) }}
                    variant="block"
                  />
                )}

                {/* Close */}
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-heading font-semibold text-sm transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
