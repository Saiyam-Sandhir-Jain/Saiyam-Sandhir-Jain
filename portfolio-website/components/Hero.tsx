'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { Personal } from '@/types/portfolio'

// ── Only change: show real photo when avatarUrl is set; initials as fallback ──
function Avatar({ initials, avatarUrl }: { initials: string; avatarUrl?: string }) {
  return (
    <div className="relative shrink-0">
      <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-zinc-700 shadow-xl shadow-black/40">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={initials}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 96px, 112px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(255,69,0,0.35) 0%, rgba(180,30,0,0.5) 100%)' }}
          >
            <span className="font-heading font-bold text-2xl text-white/90">{initials}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Only change: dot colour driven by `available` prop ──────────────────────
function StatusBadge({ available, narrow = false }: { available: boolean; narrow?: boolean }) {
  const dotColor = available ? '#22c55e' : '#f97316'
  const label    = available ? 'Exploring Roles' : 'Not Seeking'

  return (
    <div
      className="flex items-center gap-1.5 rounded-full"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        padding: narrow ? '4px 8px' : '4px 10px',
      }}
    >
      <div className="relative flex h-1.5 w-1.5">
        {available && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: dotColor }} />
        )}
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: dotColor }} />
      </div>
      <span className="uppercase tracking-widest text-[9px] font-heading font-semibold text-zinc-400">{label}</span>
    </div>
  )
}

export function Hero({ personal }: { personal: Personal }) {
  const [copied, setCopied] = useState(false)

  const copyEmail = async () => {
    await navigator.clipboard.writeText(personal.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bento-item">
      <div
        className="relative overflow-hidden rounded-xl border p-5 lg:p-6"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Subtle radial gradient */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 70% 60% at 75% 120%, rgba(255,69,0,0.07), transparent)'
        }} />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          {/* ── Mobile-only top row: Avatar (left) + badge (right) ── */}
          <div className="flex sm:hidden items-center justify-between">
            <Avatar initials={personal.initials} avatarUrl={personal.avatarUrl || undefined} />
            {<StatusBadge available={personal.available} narrow />}
          </div>

          {/* ── Left column ── */}
          <div className="flex-1 min-w-0">
            <p className="text-zinc-400 font-body text-xs tracking-wide sm:mb-8">
              {personal.title}
            </p>

            <h1 className="font-heading font-bold text-2xl lg:text-3xl text-white mb-2 leading-tight tracking-tight sm:mt-0">
              {personal.name}
            </h1>

            <p className="text-zinc-400 font-body text-sm leading-relaxed max-w-md mb-5">
              {personal.bio}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Résumé */}
              <a
                href={personal.resumeUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg',
                  'font-heading font-semibold text-xs text-white',
                  'hover:brightness-110 hover:scale-105',
                  'transition-all duration-200 shadow-md'
                )}
                style={{ backgroundColor: '#FF4500', boxShadow: '0 4px 14px rgba(255,69,0,0.3)' }}
              >
                Résumé
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>

              {/* Copy Email */}
              <button
                onClick={copyEmail}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg',
                  'border border-zinc-700 text-zinc-300 font-heading font-semibold text-xs',
                  'hover:bg-zinc-800 hover:text-white hover:border-zinc-600',
                  'transition-all duration-200'
                )}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    Copy Email
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Right column: desktop only ── */}
          <div className="hidden sm:flex flex-col items-end gap-6 shrink-0">
            <StatusBadge available={personal.available} />
            <Avatar initials={personal.initials} avatarUrl={personal.avatarUrl || undefined} />
          </div>
        </div>
      </div>
    </div>
  )
}
