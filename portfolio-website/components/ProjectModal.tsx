'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Project } from '@/types/portfolio'

interface ProjectModalProps {
  project: Project | null
  onClose: () => void
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  useEffect(() => {
    if (!project) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [project, onClose])

  const typeLabel = project?.type === 'tall' ? 'Mobile App' : project?.label || 'Project'

  const title       = project?.modalHeading    || project?.title       || ''
  const subtitle    = project?.modalSubheading || project?.description || ''
  const abstract    = project?.modalAbstract   || project?.description || ''
  const tags        = project?.modalTags       ?? []
  const links       = project?.modalLinks      ?? []
  const primaryLink = links[0] ?? (project?.url && project.url !== '#' ? { label: 'View', url: project.url } : null)

  // Upcoming-state logic for highlights research/patent tiles
  const isResearch = project?.subtype === 'research'
  const isPatent   = project?.subtype === 'patent'
  const isUpcoming = project?.modalStatus === 'upcoming'

  // For upcoming research: disable the view button
  const viewDisabled = isResearch && isUpcoming
  // For upcoming patent: disable the primary action
  const patentDisabled = isPatent && isUpcoming

  const primaryDisabled = viewDisabled || patentDisabled

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
            style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
          />

          {/* Drawer */}
          <motion.div
            key="modal"
            initial={{ y: '100%', opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[960px] mx-auto px-4 pb-4"
          >
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse 60% 80% at 20% 100%, rgba(255,69,0,0.12) 0%, transparent 60%)' }}
              />

              <div className="relative p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-2"
                      style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}
                    >
                      {typeLabel}
                    </span>

                    {/* Show upcoming badge for research/patent highlights */}
                    {isUpcoming && (isResearch || isPatent) && (
                      <span
                        className="inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-heading font-semibold tracking-widest uppercase mb-2"
                        style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
                      >
                        Upcoming
                      </span>
                    )}

                    <h2 className="font-heading font-bold text-white text-2xl lg:text-3xl tracking-tight">
                      {title}
                    </h2>
                    <p className="text-zinc-400 font-body text-sm mt-1">{subtitle}</p>
                  </div>

                  <button
                    onClick={onClose}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Content grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">
                    <div
                      className="rounded-xl p-4"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-2">About this project</p>
                      <p className="text-zinc-300 text-sm leading-relaxed font-body">
                        {abstract || `${subtitle}. More details coming soon.`}
                      </p>
                    </div>

                    {tags.length > 0 && (
                      <div
                        className="rounded-xl p-4"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p className="text-zinc-500 text-xs font-heading uppercase tracking-widest mb-3">Stack / Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded text-[11px] font-body"
                              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Primary link / disabled state */}
                    {primaryLink && !primaryDisabled ? (
                      <a
                        href={primaryLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-heading font-semibold text-sm text-white transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                        style={{ backgroundColor: '#FF4500', boxShadow: '0 4px 20px rgba(255,69,0,0.3)' }}
                      >
                        {primaryLink.label}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="7" y1="17" x2="17" y2="7"/>
                          <polyline points="7 7 17 7 17 17"/>
                        </svg>
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-heading font-semibold text-sm text-white cursor-not-allowed"
                        style={{ backgroundColor: '#FF4500', opacity: 0.4 }}
                      >
                        {isUpcoming ? (isResearch ? 'Not Published Yet' : 'Not Filed Yet') : (primaryLink?.label ?? 'Link Coming Soon')}
                      </button>
                    )}

                    {/* Additional links */}
                    {links.slice(1).map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl font-heading font-semibold text-sm text-zinc-300 transition-all duration-200 hover:text-white text-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {link.label}
                      </a>
                    ))}

                    <button
                      onClick={onClose}
                      className="w-full py-3 rounded-xl font-heading font-semibold text-sm text-zinc-400 transition-all duration-200 hover:text-white"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
