'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContribDay {
  date: string
  count: number
  level: number
}

interface ContribData {
  contributions: ContribDay[]
  total: Record<string, number>
}

interface GHRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  forks_count: number
  language: string | null
  topics: string[]
  updated_at: string
  fork: boolean
  open_issues_count: number
  watchers_count: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GH_USER = 'Saiyam-Sandhir-Jain'

const HEAT_COLORS: Record<number, string> = {
  0: 'rgba(255,255,255,0.05)',
  1: '#4a1500',
  2: '#7a2400',
  3: '#b53600',
  4: '#FF4500',
}

const LANG_COLORS: Record<string, string> = {
  TypeScript:  '#3178c6',
  JavaScript:  '#f1e05a',
  Python:      '#3572A5',
  Java:        '#b07219',
  'C++':       '#f34b7d',
  C:           '#555555',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  Rust:        '#dea584',
  Go:          '#00ADD8',
  Shell:       '#89e051',
  'Jupyter Notebook': '#DA5B0B',
  Dart:        '#00B4AB',
  Swift:       '#F05138',
  Kotlin:      '#A97BFF',
  Ruby:        '#701516',
  PHP:         '#4F5D95',
  'C#':        '#178600',
  Scala:       '#c22d40',
  R:           '#198CE7',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupIntoWeeks(days: ContribDay[]): (ContribDay | null)[][] {
  if (!days.length) return []
  const weeks: (ContribDay | null)[][] = []
  let week: (ContribDay | null)[] = []

  days.forEach((day, i) => {
    const dow = new Date(day.date + 'T12:00:00').getDay() // 0 = Sun

    if (i === 0 && dow > 0) {
      for (let p = 0; p < dow; p++) week.push(null)
    }

    week.push(day)

    if (dow === 6 || i === days.length - 1) {
      while (week.length < 7) week.push(null)
      weeks.push([...week])
      week = []
    }
  })

  return weeks
}

function totalStars(repos: GHRepo[]) {
  return repos.reduce((a, r) => a + r.stargazers_count, 0)
}

function topLanguages(repos: GHRepo[]): string[] {
  const counts: Record<string, number> = {}
  repos.forEach(r => {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang)
}

// ─── Arrow Icon ───────────────────────────────────────────────────────────────

function ArrowIcon() {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300"
      style={{ backgroundColor: '#FF4500', boxShadow: '0 4px 12px rgba(255,69,0,0.35)' }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <line x1="7" y1="17" x2="17" y2="7"/>
        <polyline points="7 7 17 7 17 17"/>
      </svg>
    </div>
  )
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function ContributionHeatmap({ data }: { data: ContribData }) {
  const allWeeks  = groupIntoWeeks(data.contributions)
  const weeks     = allWeeks.slice(-45)

  // Month label for each week column
  const monthMap: Record<number, string> = {}
  weeks.forEach((week, wi) => {
    week.forEach(day => {
      if (!day) return
      const d = new Date(day.date + 'T12:00:00')
      if (d.getDate() === 1) monthMap[wi] = MONTH_NAMES[d.getMonth()]
    })
  })

  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 10.5)
  const totalContribs = data.contributions.filter(d => new Date(d.date + 'T12:00:00') >= cutoff).reduce((a, d) => a + d.count, 0)
  const CELL = 13
  const GAP  = 3

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-heading font-bold text-white text-xl">
          {totalContribs.toLocaleString()}
        </span>
        <span className="text-zinc-500 text-xs font-heading tracking-wide">
          contributions in the last 45 weeks
        </span>
      </div>

      {/* Grid container */}
      <div className="overflow-x-auto pb-1">
        <div style={{ display: 'inline-flex', gap: GAP, alignItems: 'flex-start' }}>

          {/* Day-of-week labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginTop: CELL + GAP + 4, marginRight: 2 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{
                height: CELL,
                width: 10,
                lineHeight: `${CELL}px`,
                fontSize: 9,
                color: 'rgba(255,255,255,0.2)',
                textAlign: 'right',
              }}>
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>

          {/* Weeks columns */}
          <div>
            {/* Month labels row */}
            <div style={{ display: 'flex', gap: GAP, marginBottom: 4, height: CELL }}>
              {weeks.map((_, wi) => (
                <div key={wi} style={{ width: CELL, flexShrink: 0, fontSize: 9, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                  {monthMap[wi] || ''}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'flex', gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={day?.count ? `${day.date}: ${day.count} contribution${day.count !== 1 ? 's' : ''}` : day?.date || ''}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 3,
                        backgroundColor: day ? (HEAT_COLORS[day.level] ?? HEAT_COLORS[0]) : 'transparent',
                        flexShrink: 0,
                        transition: 'filter 0.15s',
                        cursor: day?.count ? 'default' : 'default',
                      }}
                      className={cn(day?.count ? 'hover:brightness-125' : '')}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Less</span>
        {[0,1,2,3,4].map(level => (
          <div key={level} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: HEAT_COLORS[level] }} />
        ))}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>More</span>
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl flex-1 min-w-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="shrink-0 text-[#FF4500]">{icon}</div>
      <div className="min-w-0">
        <div className="font-heading font-bold text-white text-base leading-none mb-0.5">{value}</div>
        <div className="text-zinc-500 text-[10px] font-heading tracking-widest uppercase">{label}</div>
      </div>
    </div>
  )
}

// ─── Repo Tile ────────────────────────────────────────────────────────────────

function RepoTile({ repo }: { repo: GHRepo }) {
  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? '#8b8b8b') : null
  const tileRef   = useRef<HTMLAnchorElement>(null)
  const shaking   = useRef(false)

  const handleMouseEnter = async () => {
    if (shaking.current || !tileRef.current) return
    shaking.current = true
    try {
      const animeModule = await import('animejs')
      const anime = (animeModule.default ?? animeModule) as any
      anime({
        targets: tileRef.current,
        rotate: [
          { value:  0,    duration: 0   },
          { value: -3,    duration: 100, easing: 'easeInOutSine' },
          { value:  3,    duration: 120, easing: 'easeInOutSine' },
          { value: -2.5,  duration: 110, easing: 'easeInOutSine' },
          { value:  2.5,  duration: 110, easing: 'easeInOutSine' },
          { value: -1.5,  duration: 100, easing: 'easeInOutSine' },
          { value:  0,    duration: 90,  easing: 'easeOutSine'   },
        ],
        complete: () => { shaking.current = false },
      })
    } catch {
      shaking.current = false
    }
  }

  return (
    <a
      ref={tileRef}
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={handleMouseEnter}
      className="bento-item group block rounded-xl p-4 transition-[border-color,box-shadow,opacity] duration-300 ease-out cursor-pointer hover:shadow-xl"
      style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)', transformOrigin: 'center', willChange: 'transform' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {/* Repo name */}
          <h3 className="font-heading font-semibold text-white text-sm leading-snug truncate group-hover:text-[#FF4500] transition-colors duration-200">
            {repo.name}
          </h3>
        </div>
        <div className="shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300">
          <ArrowIcon />
        </div>
      </div>

      {/* Description */}
      <p className="text-zinc-500 text-xs leading-relaxed mb-3 line-clamp-2" style={{ minHeight: '2.4em' }}>
        {repo.description || 'No description provided.'}
      </p>

      {/* Topics */}
      {repo.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {repo.topics.slice(0, 3).map(topic => (
            <span
              key={topic}
              className="px-1.5 py-0.5 rounded text-[9px] font-heading font-medium tracking-wide"
              style={{ backgroundColor: 'rgba(255,69,0,0.12)', color: '#FF6A30', border: '1px solid rgba(255,69,0,0.2)' }}
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Footer: language + stars + forks */}
      <div className="flex items-center gap-3 mt-auto">
        {langColor && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: langColor }} />
            <span className="text-zinc-400 text-[10px] font-heading">{repo.language}</span>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* Stars */}
          <div className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="text-zinc-500 text-[10px] font-heading">{repo.stargazers_count}</span>
          </div>

          {/* Forks */}
          {repo.forks_count > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
                <circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/>
                <path d="M6 9v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"/>
                <line x1="12" y1="12" x2="12" y2="15"/>
              </svg>
              <span className="text-zinc-500 text-[10px] font-heading">{repo.forks_count}</span>
            </div>
          )}
        </div>
      </div>
    </a>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded animate-pulse', className)}
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
    />
  )
}

function HeatmapSkeleton() {
  return (
    <div
      className="bento-item rounded-xl p-6"
      style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <Skeleton className="h-5 w-48 mb-4" />
      <Skeleton className="h-28 w-full mb-4" />
      <div className="flex gap-3 mt-6">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 flex-1" />)}
      </div>
    </div>
  )
}

function RepoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_TTL: Record<string, number> = {
  contrib: 6 * 60 * 60 * 1000,   // 6 hours for contribution heatmap
  repos:   1 * 60 * 60 * 1000,   // 1 hour  for repo list
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`gh_cache_${key}`)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T }
    if (Date.now() - ts > (CACHE_TTL[key] ?? 3_600_000)) return null
    return data
  } catch { return null }
}

function cacheSet(key: string, data: unknown) {
  try { localStorage.setItem(`gh_cache_${key}`, JSON.stringify({ ts: Date.now(), data })) } catch {}
}



export function GitHubProjects() {
  const [contribData, setContribData] = useState<ContribData | null>(null)
  const [repos, setRepos]             = useState<GHRepo[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const containerRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        // ── Try cache first ──────────────────────────────────────────────
        const cachedContrib = cacheGet<ContribData>('contrib')
        const cachedRepos   = cacheGet<GHRepo[]>('repos')

        if (cachedContrib && cachedRepos) {
          setContribData(cachedContrib)
          setRepos(
            cachedRepos
              .filter(r => !r.fork)
              .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
          setLoading(false)
          return
        }

        // ── Fetch fresh ──────────────────────────────────────────────────
        const [contribRes, reposRes] = await Promise.all([
          fetch(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`),
          fetch(`https://api.github.com/users/${GH_USER}/repos?sort=updated&per_page=40&type=public`),
        ])

        if (!contribRes.ok || !reposRes.ok) throw new Error('API error')

        const contrib: ContribData = await contribRes.json()
        const rawRepos: GHRepo[]   = await reposRes.json()

        // Persist to cache before setting state
        cacheSet('contrib', contrib)
        cacheSet('repos', rawRepos)

        setContribData(contrib)
        setRepos(
          rawRepos
            .filter(r => !r.fork)
            .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        )
      } catch {
        setError('Could not load GitHub data. Check back later.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Animate bento items after data is loaded
  useEffect(() => {
    if (loading) return
    const el = containerRef.current
    if (!el) return

    const targets = Array.from(el.querySelectorAll<HTMLElement>('.bento-item'))
    if (!targets.length) return

    targets.forEach(t => {
      t.style.opacity = '0'
      t.style.transform = 'scale(0.88) translateY(12px)'
      t.style.willChange = 'transform, opacity'
    })

    const run = async () => {
      try {
        const animeModule = await import('animejs')
        const anime = animeModule.default ?? animeModule
        anime({
          targets,
          scale:      [0.88, 1],
          opacity:    [0, 1],
          translateY: [12, 0],
          delay:      (anime as any).stagger(80, { start: 0 }),
          easing:     'easeOutElastic(1, .75)',
          duration:   950,
          complete: () => { targets.forEach(t => { t.style.willChange = 'auto' }) },
        })
      } catch {
        targets.forEach((t, i) => {
          t.style.transition = `opacity 0.5s ease ${i * 70}ms, transform 0.5s ease ${i * 70}ms`
          t.style.opacity = '1'
          t.style.transform = 'scale(1) translateY(0)'
        })
      }
    }
    // Small delay to allow DOM to settle after state update
    const id = setTimeout(run, 30)
    return () => clearTimeout(id)
  }, [loading])

  // Split repos into two columns
  const leftRepos  = repos.filter((_, i) => i % 2 === 0)
  const rightRepos = repos.filter((_, i) => i % 2 === 1)

  const stars     = totalStars(repos)
  const topLangs  = topLanguages(repos)

  if (loading) {
    return (
      <div className="space-y-3">
        <HeatmapSkeleton />
        <RepoGridSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="bento-item rounded-xl p-8 flex flex-col items-center justify-center text-center"
        style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div className="text-2xl mb-2">⚠️</div>
        <p className="text-zinc-400 text-sm font-heading">{error}</p>
        <a
          href={`https://github.com/${GH_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-[#FF4500] text-xs font-heading hover:underline"
        >
          View on GitHub →
        </a>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="space-y-3">

      {/* ── GitHub Stats Card (heatmap + stats bar) ── */}
      <div
        className="bento-item rounded-xl p-6 relative overflow-hidden animate-bento-in"
        style={{ backgroundColor: '#1c1a18', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        {/* Subtle orange glow bottom-right */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 50% 60% at 100% 100%, rgba(255,69,0,0.07), transparent)'
        }} />

        {/* Section label */}
        <div className="relative flex items-center gap-3 mb-5">
          <span className="font-heading font-bold text-white text-base tracking-tight">GitHub Activity</span>
          <a
            href={`https://github.com/${GH_USER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-heading font-semibold text-xs text-zinc-400 hover:text-[#FF4500] transition-colors duration-200 border ml-auto"
            style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            {GH_USER}
          </a>
        </div>

        {/* Heatmap */}
        <div className="relative">
          {contribData && <ContributionHeatmap data={contribData} />}
        </div>

        {/* Stats row — 2x2 on mobile, single row on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-3 mt-5">
          <StatBadge
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>}
            value={repos.length}
            label="Repos"
          />
          <StatBadge
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            value={stars}
            label="Total Stars"
          />
          <StatBadge
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>}
            value={repos.reduce((a, r) => a + r.forks_count, 0)}
            label="Total Forks"
          />
          {topLangs[0] && (
            <StatBadge
              icon={<div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: LANG_COLORS[topLangs[0]] ?? '#8b8b8b' }} />}
              value={topLangs[0]}
              label="Top Language"
            />
          )}
        </div>

        {/* Top languages tags */}
        {topLangs.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-zinc-600 text-[10px] font-heading uppercase tracking-widest">Languages</span>
            {topLangs.map(lang => (
              <div key={lang} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LANG_COLORS[lang] ?? '#8b8b8b' }} />
                <span className="text-zinc-400 text-[10px] font-heading">{lang}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section header ── */}
      <div className="flex items-center gap-3 px-1 pt-2">
        <h2 className="font-heading font-bold text-white text-base tracking-tight">Repositories</h2>
        <span className="text-zinc-600 text-xs font-heading">{repos.length} public</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* ── Repo tiles — two independent columns ── */}

      {/* Desktop: two-column */}
      <div className="hidden lg:flex gap-3 items-start">
        <div className="flex flex-col gap-3 flex-1">
          {leftRepos.map(repo => <RepoTile key={repo.id} repo={repo} />)}
        </div>
        <div className="flex flex-col gap-3 flex-1">
          {rightRepos.map(repo => <RepoTile key={repo.id} repo={repo} />)}
        </div>
      </div>

      {/* Mobile: single column */}
      <div className="flex flex-col gap-3 lg:hidden">
        {repos.map(repo => <RepoTile key={repo.id} repo={repo} />)}
      </div>

    </div>
  )
}
