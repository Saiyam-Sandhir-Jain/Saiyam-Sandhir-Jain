'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/portfolio'

// ─── Arrow Icon ───────────────────────────────────────────────────────────
function ArrowIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300',
        className
      )}
      style={{ backgroundColor: '#FF4500', boxShadow: '0 4px 12px rgba(255,69,0,0.35)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <line x1="7" y1="17" x2="17" y2="7"/>
        <polyline points="7 7 17 7 17 17"/>
      </svg>
    </div>
  )
}

// ─── Realistic iPhone Mockup ──────────────────────────────────────────────
// If phoneImageUrl (transparent-bg PNG) is provided it replaces the SVG entirely.
// The hover scale lives on the wrapper so both paths share the same animation.
function RealisticPhone({ imageUrl, phoneImageUrl }: { imageUrl?: string; phoneImageUrl?: string }) {
  return (
    <div
      className="relative transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      style={{
        width: '200px',
        filter: phoneImageUrl
          ? 'drop-shadow(0 6px 18px rgba(0,0,0,0.35)) drop-shadow(0 2px 5px rgba(0,0,0,0.22))'
          : 'drop-shadow(0 6px 18px rgba(0,0,0,0.45)) drop-shadow(0 2px 5px rgba(0,0,0,0.28))',
      }}
    >
      {phoneImageUrl ? (
        // Custom phone image (transparent PNG) — replaces the SVG mockup
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={phoneImageUrl}
          alt="Phone mockup"
          style={{ width: '200px', height: 'auto', display: 'block' }}
        />
      ) : (
      <svg viewBox="0 0 200 420" width="200" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <defs>
          {/* Screen clip — rx=26 matches real phone screen corner radius */}
          <clipPath id="screen-clip">
            <rect x="14" y="12" width="172" height="396" rx="26"/>
          </clipPath>
          {/* Phone body gradient — visibly lighter than card background (#1c1a18) */}
          <linearGradient id="body-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#4a4a4e"/>
            <stop offset="6%"   stopColor="#313135"/>
            <stop offset="94%"  stopColor="#313135"/>
            <stop offset="100%" stopColor="#4a4a4e"/>
          </linearGradient>
          {/* Highlight stripe on top edge */}
          <linearGradient id="top-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.14)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>

        {/* ── Phone body ── */}
        <rect x="0" y="0" width="200" height="420" rx="36" fill="url(#body-grad)" />
        {/* Outer edge highlight */}
        <rect x="0.75" y="0.75" width="198.5" height="418.5" rx="35.5" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5"/>
        {/* Top shine */}
        <rect x="1" y="1" width="198" height="80" rx="35" fill="url(#top-shine)" />

        {/* ── Screen background ── */}
        <rect x="14" y="12" width="172" height="396" rx="26" fill="#050507"/>

        {/* ── App screenshot — clipped to screen ── */}
        {imageUrl && (
          <image
            href={imageUrl}
            x="14" y="12" width="172" height="396"
            clipPath="url(#screen-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        )}

        {/* ── Dynamic Island + camera — drawn AFTER image → always on top ── */}
        <rect x="68" y="19" width="64" height="20" rx="10" fill="#000"/>
        <circle cx="118" cy="29" r="5" fill="#0d0d0f"/>
        <circle cx="118" cy="29" r="3" fill="#070709"/>

        {/* ── Status bar icons (time area + signal/battery) ── */}
        <rect x="22" y="21" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.15)"/>
        <rect x="152" y="21" width="9"  height="5" rx="2"   fill="rgba(255,255,255,0.15)"/>
        <rect x="163" y="21" width="9"  height="5" rx="2"   fill="rgba(255,255,255,0.15)"/>
        <rect x="175" y="21" width="13" height="5" rx="2.5" fill="rgba(255,255,255,0.15)"/>

        {/* ── Side buttons ── */}
        <rect x="-1"    y="100" width="3.5" height="20" rx="1.75" fill="#3a3a3e"/>
        <rect x="-1"    y="134" width="3.5" height="32" rx="1.75" fill="#3a3a3e"/>
        <rect x="-1"    y="178" width="3.5" height="32" rx="1.75" fill="#3a3a3e"/>
        <rect x="197.5" y="140" width="3.5" height="50" rx="1.75" fill="#3a3a3e"/>

        {/* ── Home indicator ── */}
        <rect x="76" y="405" width="48" height="4" rx="2" fill="rgba(255,255,255,0.22)"/>

        {/* ── Screen edge gloss ── */}
        <rect x="14" y="12" width="172" height="396" rx="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
      </svg>
      )}
    </div>
  )
}

// ─── Stacked Cards ────────────────────────────────────────────────────────
function StackedCards({ label, imageUrl, backImageUrl }: { label?: string; imageUrl?: string; backImageUrl?: string }) {
  return (
    <div className="relative w-full flex-1 flex items-center justify-center" style={{ minHeight: '210px' }}>
      <div
        className={cn(
          'absolute rounded-2xl shadow-md transition-all duration-500 ease-out overflow-hidden',
          '-rotate-[11deg] translate-x-2 translate-y-1.5',
          'group-hover:-rotate-[15deg] group-hover:-translate-x-6 group-hover:translate-y-3'
        )}
        style={{ width: '130px', height: '130px', backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 1 }}
      >
        {backImageUrl && (
          <div className="relative w-full h-full">
            <Image src={backImageUrl} alt="Back" fill sizes="130px" className="object-cover" />
          </div>
        )}
      </div>
      <div
        className={cn(
          'absolute rounded-2xl shadow-lg transition-all duration-500 ease-out overflow-hidden',
          '-rotate-[4deg] translate-x-1 translate-y-0.5',
          'group-hover:-rotate-[6deg] group-hover:-translate-x-2 group-hover:translate-y-1.5'
        )}
        style={{ width: '130px', height: '130px', backgroundColor: 'rgba(255,255,255,0.88)', zIndex: 2 }}
      />
      <div
        className={cn(
          'absolute rounded-2xl shadow-xl overflow-hidden transition-all duration-500 ease-out',
          'rotate-[1deg]',
          'group-hover:scale-[1.06] group-hover:rotate-[5deg]'
        )}
        style={{ width: '130px', height: '130px', backgroundColor: 'rgba(255,255,255,0.97)', zIndex: 3 }}
      >
        {imageUrl ? (
          <div className="relative w-full h-full">
            <Image src={imageUrl} alt={label ?? 'Project'} fill sizes="130px" className="object-cover" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4" style={{ backgroundColor: '#f2f2f2' }}>
            {label ? (
              <span className="text-zinc-400 text-[9px] font-semibold text-center leading-snug uppercase tracking-widest">
                {label}
              </span>
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-300" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tall Project Card ────────────────────────────────────────────────────
export function TallProject({ project, onClick }: { project: Project; onClick?: (p: Project) => void }) {
  return (
    <div
      onClick={() => onClick?.(project)}
      className="bento-item group rounded-xl flex flex-col overflow-hidden cursor-pointer
                 transition-all duration-300 flex-1 h-full relative"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Hover border glow — no blur so phone stays crisp */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,69,0,0.25)' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-2 shrink-0 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-white text-sm truncate">{project.title}</h3>
          <p className="text-zinc-500 text-xs mt-0.5 truncate">{project.description}</p>
        </div>
        <div className="shrink-0 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300">
          <ArrowIcon />
        </div>
      </div>

      {/* Phone area */}
      <div className="flex-1 relative min-h-0" style={{ minHeight: '220px' }}>
        <div
          className="lg:hidden absolute left-1/2"
          style={{ top: '10px', transform: 'translateX(-50%)' }}
        >
          <RealisticPhone imageUrl={project.imageUrl || undefined} phoneImageUrl={project.phoneImageUrl || undefined} />
        </div>
        <div
          className="hidden lg:block absolute left-1/2 top-1/2"
          style={{ transform: 'translateX(-50%) translateY(-53%)' }}
        >
          <RealisticPhone imageUrl={project.imageUrl || undefined} phoneImageUrl={project.phoneImageUrl || undefined} />
        </div>
      </div>

      {/* Subtle dark tint on hover — NO blur so phone stays sharp */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.12)' }}
      />
    </div>
  )
}

// ─── Square Project Card ──────────────────────────────────────────────────
export function SquareProject({ project, onClick }: { project: Project; onClick?: (p: Project) => void }) {
  return (
    <div
      onClick={() => onClick?.(project)}
      className="bento-item group rounded-xl p-4 flex flex-col overflow-hidden cursor-pointer
                 transition-all duration-300 flex-1 relative"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', minHeight: '280px' }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,69,0,0.25)' }}
      />

      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-white text-sm leading-snug">{project.title}</h3>
          <p className="text-zinc-500 text-xs mt-0.5">{project.description}</p>
        </div>
        <div className="shrink-0 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300">
          <ArrowIcon />
        </div>
      </div>

      <StackedCards
        label={project.label}
        imageUrl={project.imageUrl || undefined}
        backImageUrl={project.backImageUrl || undefined}
      />

      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.12)' }}
      />
    </div>
  )
}

export const Projects = { Tall: TallProject, Square: SquareProject }
