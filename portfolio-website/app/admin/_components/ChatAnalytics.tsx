'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChatAnalyticsData } from '@/app/api/admin/chat-analytics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days < 30)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeek(weekKey: string): string {
  // "2025-W22" → "Week 22, 2025"
  const m = weekKey.match(/^(\d{4})-W(\d+)$/)
  if (!m) return weekKey
  return `W${m[2]} · ${m[1]}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 border"
      style={{
        backgroundColor: accent ? 'rgba(255,69,0,0.07)' : '#1c1a18',
        borderColor:      accent ? 'rgba(255,69,0,0.25)' : '#3f3f3f',
      }}
    >
      <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span
        className="text-2xl font-bold leading-none"
        style={{ color: accent ? '#FF4500' : '#fff' }}
      >
        {value}
      </span>
      {sub && <span className="text-zinc-500 text-xs">{sub}</span>}
    </div>
  )
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 560
  const H = 56
  const pad = 4
  const step = (W - pad * 2) / (data.length - 1)

  const points = data.map((d, i) => {
    const x = pad + i * step
    const y = H - pad - ((d.count / max) * (H - pad * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const areaPoints = [
    `${pad},${H - pad}`,
    ...data.map((d, i) => {
      const x = pad + i * step
      const y = H - pad - ((d.count / max) * (H - pad * 2))
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }),
    `${pad + (data.length - 1) * step},${H - pad}`,
  ].join(' ')

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
          Daily questions — last 30 days
        </span>
        <span className="text-zinc-600 text-xs">
          peak: {max} · today: {data[data.length - 1]?.count ?? 0}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56 }}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FF4500" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FF4500" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#spark-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#FF4500"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Today's dot */}
        {(() => {
          const last = data[data.length - 1]
          if (!last) return null
          const x = pad + (data.length - 1) * step
          const y = H - pad - ((last.count / max) * (H - pad * 2))
          return <circle cx={x} cy={y} r="3" fill="#FF4500" />
        })()}
      </svg>
      {/* X-axis labels: first, mid, last */}
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

function WordCloud({ words }: { words: { word: string; count: number }[] }) {
  if (!words.length) return <p className="text-zinc-600 text-sm">No data yet.</p>
  const max = words[0].count
  return (
    <div className="flex flex-wrap gap-2">
      {words.map(({ word, count }) => {
        const ratio = count / max
        const size  = 11 + Math.round(ratio * 10)
        const op    = 0.45 + ratio * 0.55
        return (
          <span
            key={word}
            className="font-medium rounded-md px-2 py-0.5"
            style={{
              fontSize:        size,
              opacity:         op,
              color:           ratio > 0.6 ? '#FF6A30' : '#a1a1aa',
              backgroundColor: ratio > 0.6 ? 'rgba(255,69,0,0.1)' : 'transparent',
              border:          ratio > 0.6 ? '1px solid rgba(255,69,0,0.2)' : 'none',
            }}
            title={`${count} mention${count > 1 ? 's' : ''}`}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

function QuestionsFeed({ questions }: { questions: ChatAnalyticsData['recentQuestions'] }) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? questions.filter(q => q.content.toLowerCase().includes(query.toLowerCase()))
    : questions

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Filter questions…"
        className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white bg-zinc-900 border border-zinc-700 outline-none focus:border-orange-600 transition-colors"
      />
      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filtered.length === 0 && (
          <p className="text-zinc-600 text-sm py-4 text-center">No questions yet.</p>
        )}
        {filtered.map(q => (
          <div
            key={q.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <span className="text-zinc-600 text-[10px] mt-0.5 shrink-0 w-14 text-right leading-tight">
              {relativeTime(q.created_at)}
            </span>
            <p className="text-zinc-300 text-sm leading-snug">{q.content}</p>
          </div>
        ))}
      </div>
      {filtered.length > 0 && (
        <p className="text-zinc-600 text-xs mt-2 text-right">
          {filtered.length} of {questions.length} questions
        </p>
      )}
    </div>
  )
}

function RateLimitTable({ rows }: { rows: ChatAnalyticsData['rateLimitStats'] }) {
  if (!rows.length) return (
    <p className="text-zinc-600 text-sm">
      No rate-limit data. The <code className="bg-zinc-800 px-1 rounded text-zinc-400">sams_rate_limits</code> table may not exist yet.
    </p>
  )
  return (
    <div className="overflow-x-auto -mx-1" style={{ scrollbarWidth: 'thin' }}>
      <table className="w-full text-sm min-w-[320px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 pr-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Week</th>
            <th className="text-right py-2 pr-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Devices</th>
            <th className="text-right py-2 pr-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Queries</th>
            <th className="text-right py-2 text-zinc-500 text-xs font-medium uppercase tracking-wider">Hit cap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.week_key} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 pr-4 text-zinc-300 font-mono text-xs">{formatWeek(r.week_key)}</td>
              <td className="py-2.5 pr-4 text-zinc-300 text-right">{r.unique_devices}</td>
              <td className="py-2.5 pr-4 text-zinc-300 text-right">{r.total_queries}</td>
              <td className="py-2.5 text-right">
                {r.maxed_out > 0
                  ? <span className="text-orange-400 font-semibold">{r.maxed_out}</span>
                  : <span className="text-zinc-600">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-5 rounded-xl border border-zinc-700/60"
      style={{ backgroundColor: '#1c1a18' }}
    >
      <h3 className="text-white font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── Main component ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export function ChatAnalytics() {
  const [data,    setData]    = useState<ChatAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/chat-analytics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastFetched(new Date())
    } catch (e: any) {
      setError(e.message ?? 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-18 0" />
          </svg>
          Loading analytics…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4 rounded-lg bg-red-900/20 border border-red-800/40">
        Failed to load analytics: {error}
        <button onClick={fetchData} className="ml-3 underline hover:text-red-300">retry</button>
      </div>
    )
  }

  if (!data) return null

  const { stats, recentQuestions, topWords, dailyActivity, rateLimitStats } = data

  return (
    <div className="space-y-6">

      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-600 text-xs">
          {lastFetched ? `Last updated ${relativeTime(lastFetched.toISOString())}` : ''}
        </p>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50"
        >
          <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total sessions"   value={stats.totalSessions}      accent />
        <StatCard label="User questions"   value={stats.totalUserMessages}  accent />
        <StatCard label="Unique devices"   value={stats.uniqueDevices}      />
        <StatCard label="Avg Q / session"  value={stats.avgMessagesPerSession} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Last 7 days"  value={stats.last7Days}  sub="user messages" />
        <StatCard label="Last 30 days" value={stats.last30Days} sub="user messages" />
      </div>
      {/* ── Sparkline ── */}
      <Section title="Activity">
        <Sparkline data={dailyActivity} />
      </Section>

      {/* ── Top words ── */}
      <Section title="Common topics & keywords">
        {stats.totalUserMessages === 0
          ? <p className="text-zinc-600 text-sm">No questions yet — topics will appear here once visitors start chatting with Sams.</p>
          : <WordCloud words={topWords} />
        }
      </Section>

      {/* ── Recent questions ── */}
      <Section title={`Recent questions (${Math.min(recentQuestions.length, 50)} most recent)`}>
        <QuestionsFeed questions={recentQuestions} />
      </Section>

      {/* ── Rate limit ── */}
      <Section title="Rate-limit usage by week">
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Each row is one ISO week. "Hit cap" = devices that used all 10 questions — good signal for which weeks had highly engaged visitors.
        </p>
        <RateLimitTable rows={rateLimitStats} />
      </Section>

    </div>
  )
}
