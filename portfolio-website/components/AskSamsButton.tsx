'use client'

import { useRef, useState } from 'react'

interface AskSamsButtonProps {
  query:      string
  onAsk:      (query: string) => void
  className?: string
  /**
   * block  — full-width (default, used in most modals)
   * inline — flex-1, shares a row with another button
   * fit    — natural/intrinsic width + same height as Close button
   *          (cert & LOR viewers)
   */
  variant?:   'block' | 'inline' | 'fit'
}

// ─── 4-point star / sparkle icon — bolder arms, blinking like SJ navbar ──────
function SamsStarIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="currentColor" stroke="none"
      aria-hidden="true"
      style={{ animation: 'sams-star-blink 2s ease-in-out infinite', flexShrink: 0 }}
    >
      {/* Wider arms (inner corners at 10, outer tips at 14) for a bolder look */}
      <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
    </svg>
  )
}

export function AskSamsButton({ query, onAsk, className = '', variant = 'block' }: AskSamsButtonProps) {
  const [hovered, setHovered] = useState(false)
  // ── Fixed per-instance random delay so multiple buttons don't shimmer in sync ──
  const delayRef = useRef(Math.floor(Math.random() * 1200))

  // ── Size classes vary per variant ─────────────────────────────────────────────
  // 'fit' mirrors the Close button: px-5 py-2 text-xs rounded-lg, no flex-grow.
  const sizeClasses =
    variant === 'block'  ? 'w-full py-3 text-sm rounded-xl'        :
    variant === 'fit'    ? 'shrink-0 px-5 py-2 text-xs rounded-lg' :
    /* inline */           'flex-1 py-3 text-sm rounded-xl'

  return (
    <>
      {/* ── Keyframe definitions ───────────────────────────────────────────────
          Inlined here (same pattern as Navbar's sj-diamond-blink) — no globals.css
          change needed. Duplicate @keyframe declarations are harmless per the spec.

          sams-shimmer timing:
            • Total: 3.5 s
            • 0 → 63% = 2.2 s  — the visible sweep (slower than before)
            • 63 → 100% = 1.3 s — pause hidden off-screen right (shorter gap)
            • Loop-restart jump +105% → -105% is invisible (both off-screen). ── */}
      <style>{`
        @keyframes sams-shimmer {
          0%   { transform: translateX(-105%); animation-timing-function: cubic-bezier(0.4,0,0.2,1); }
          63%  { transform: translateX(105%);  animation-timing-function: step-end; }
          100% { transform: translateX(105%); }
        }
        @keyframes sams-star-blink {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%      { opacity: 0.3; transform: scale(0.75); }
        }
      `}</style>

      <button
        onClick={() => onAsk(query)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          relative overflow-hidden
          flex items-center justify-center gap-2
          font-heading font-semibold
          transition-all duration-200
          ${sizeClasses}
          ${hovered ? 'scale-[1.02]' : 'scale-100'}
          ${className}
        `}
        style={{
          backgroundColor: hovered ? 'rgba(255,69,0,0.15)' : 'var(--bg-elevated)',
          border:          '1px solid rgba(255,69,0,0.55)',
          color:           hovered ? '#FF6A30' : 'rgba(255,105,48,0.9)',
          boxShadow:       hovered
            ? '0 4px 20px rgba(255,69,0,0.22), inset 0 0 0 1px rgba(255,69,0,0.3)'
            : '0 0 0 0 transparent',
          touchAction: 'manipulation',
        }}
      >
        {/* ── Shimmer stripe ──────────────────────────────────────────────────
            w-full = full button width. Diagonal gradient creates a narrow centre
            highlight band; outer thirds are transparent so only the band sweeps. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-full"
          style={{
            background:     'linear-gradient(105deg, transparent 25%, rgba(255,120,60,0.38) 50%, transparent 75%)',
            transform:      'translateX(-105%)',
            animation:      'sams-shimmer 3.5s linear infinite',
            animationDelay: `${delayRef.current}ms`,
          }}
        />

        {/* Content — text first, blinking star after */}
        <span>Ask Sams</span>
        <SamsStarIcon />
      </button>
    </>
  )
}
