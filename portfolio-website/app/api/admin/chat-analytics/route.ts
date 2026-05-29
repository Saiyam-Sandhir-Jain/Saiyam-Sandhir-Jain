import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Auth guard ───────────────────────────────────────────────────────────────
async function isAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return !!(session && session.user.email === process.env.ADMIN_EMAIL)
}

// ─── Types returned to the client ─────────────────────────────────────────────
export interface ChatAnalyticsData {
  stats: {
    totalSessions:      number
    totalMessages:      number
    totalUserMessages:  number
    uniqueDevices:      number
    avgMessagesPerSession: number
    last7Days:          number   // user messages in last 7 days
    last30Days:         number   // user messages in last 30 days
  }
  recentQuestions: {
    id:         string
    content:    string
    created_at: string
  }[]
  topWords: {
    word:  string
    count: number
  }[]
  dailyActivity: {
    date:  string
    count: number
  }[]
  rateLimitStats: {
    week_key:        string
    unique_devices:  number
    total_queries:   number
    maxed_out:       number   // devices that hit the 10-query cap
  }[]
}

// ─── Stop-words to exclude from word frequency ────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall',
  'can','i','you','he','she','it','we','they','what','which','who','this',
  'that','these','those','about','tell','me','my','his','your','their','any',
  's','saiyam','please','know','does','did','has','get','also','just','more',
])

function extractTopWords(messages: string[], topN = 20): { word: string; count: number }[] {
  const freq: Record<string, number> = {}
  for (const msg of messages) {
    const words = msg
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }))
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // ── 1. All user messages ──────────────────────────────────────────────────
  const { data: userMessages } = await db
    .from('chat_messages')
    .select('id, content, created_at, session_id')
    .eq('role', 'user')
    .order('created_at', { ascending: false })

  const msgs = userMessages ?? []

  // ── 2. Session count + unique devices ─────────────────────────────────────
  const { data: sessions } = await db
    .from('chat_sessions')
    .select('id, device_token, started_at')

  const sess = sessions ?? []
  const uniqueDevices = new Set(sess.map(s => s.device_token)).size

  // ── 3. Total messages (all roles) ─────────────────────────────────────────
  const { count: totalMessages } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })

  // ── 4. Daily activity (last 30 days) ──────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()

  const recentMsgs    = msgs.filter(m => m.created_at >= thirtyDaysAgo)
  const last7DaysMsgs = msgs.filter(m => m.created_at >= sevenDaysAgo)

  // Group by date (YYYY-MM-DD)
  const byDate: Record<string, number> = {}
  for (const m of recentMsgs) {
    const date = m.created_at.slice(0, 10)
    byDate[date] = (byDate[date] ?? 0) + 1
  }
  // Fill in all 30 days (even zeros) for a complete sparkline
  const dailyActivity: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyActivity.push({ date: key, count: byDate[key] ?? 0 })
  }

  // ── 5. Top words from user questions ──────────────────────────────────────
  const topWords = extractTopWords(msgs.map(m => m.content))

  // ── 6. Rate limit stats (per-week summary) ────────────────────────────────
  // The sams_rate_limits table has ip_hash, week_key, count columns.
  // We aggregate by week_key; devices with count >= 10 are "maxed out".
  let rateLimitStats: ChatAnalyticsData['rateLimitStats'] = []
  try {
    const { data: rlRows } = await db
      .from('sams_rate_limits')
      .select('ip_hash, week_key, count')
      .order('week_key', { ascending: false })

    if (rlRows) {
      const byWeek: Record<string, { unique: Set<string>; total: number; maxed: number }> = {}
      for (const row of rlRows) {
        if (!byWeek[row.week_key]) byWeek[row.week_key] = { unique: new Set(), total: 0, maxed: 0 }
        byWeek[row.week_key].unique.add(row.ip_hash)
        byWeek[row.week_key].total  += row.count
        if (row.count >= 10) byWeek[row.week_key].maxed += 1
      }
      rateLimitStats = Object.entries(byWeek)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 8)
        .map(([week_key, v]) => ({
          week_key,
          unique_devices: v.unique.size,
          total_queries:  v.total,
          maxed_out:      v.maxed,
        }))
    }
  } catch {
    // Table may not exist yet — silently ignore
  }

  // ── 7. Avg messages per session ───────────────────────────────────────────
  const avgMsgPerSession = sess.length > 0
    ? Math.round((msgs.length / sess.length) * 10) / 10
    : 0

  const payload: ChatAnalyticsData = {
    stats: {
      totalSessions:         sess.length,
      totalMessages:         totalMessages ?? 0,
      totalUserMessages:     msgs.length,
      uniqueDevices,
      avgMessagesPerSession: avgMsgPerSession,
      last7Days:             last7DaysMsgs.length,
      last30Days:            recentMsgs.length,
    },
    recentQuestions: msgs.slice(0, 50).map(m => ({
      id:         m.id,
      content:    m.content,
      created_at: m.created_at,
    })),
    topWords,
    dailyActivity,
    rateLimitStats,
  }

  return NextResponse.json(payload)
}
