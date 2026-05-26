import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const RATE_LIMIT = 10
const API_BASE   = process.env.SAMS_API_URL

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryTurn {
  role:    'user' | 'model'
  content: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeekKey(): string {
  const now  = new Date()
  const year = now.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const diff = now.getTime() - startOfWeek1.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** One-way hash with a server-side salt — safe to store in DB */
function hashValue(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? 'sams-default-salt'
  return crypto
    .createHash('sha256')
    .update(value + salt)
    .digest('hex')
    .slice(0, 32)
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

/**
 * Validates and sanitizes the conversation_history field from the request body.
 * Returns a clean array of {role, content} turns, or null if nothing usable.
 *
 * - Only keeps turns with valid roles ('user' | 'model') and non-empty string content.
 * - Caps at 20 turns to bound upstream payload size (backend caps at 8 anyway).
 * - Trims each content string.
 */
function parseConversationHistory(raw: unknown): HistoryTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  const valid: HistoryTurn[] = raw
    .filter(
      (item): item is { role: string; content: string } =>
        item !== null &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'model') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .map(item => ({
      role:    item.role as 'user' | 'model',
      content: item.content.trim().slice(0, 2000), // mirror backend max_length
    }))
    .slice(-20) // keep only the most recent 20 turns

  return valid.length > 0 ? valid : null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { error: 'Sams AI is not configured on this server.' },
      { status: 503 }
    )
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  let query:               string
  let matchCount:          number
  let fingerprint:         string | null
  let conversationHistory: HistoryTurn[] | null

  try {
    const body          = await request.json()
    query               = typeof body?.query === 'string' ? body.query.trim() : ''
    matchCount          = typeof body?.match_count === 'number' ? body.match_count : 5
    fingerprint         = typeof body?.fingerprint === 'string' ? body.fingerprint : null
    conversationHistory = parseConversationHistory(body?.conversation_history)
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!query || query.length > 1000) {
    return NextResponse.json(
      { error: 'Query must be between 1 and 1000 characters.' },
      { status: 400 }
    )
  }

  // ── Determine device token ─────────────────────────────────────────────────
  const existingCookie = request.cookies.get('sams_device')?.value
  let deviceToken: string
  let isNewToken = false

  if (existingCookie) {
    deviceToken = existingCookie
  } else if (fingerprint) {
    deviceToken = hashValue(fingerprint + getClientIP(request))
    isNewToken  = true
  } else {
    deviceToken = crypto.randomUUID()
    isNewToken  = true
  }

  // ── Server-side rate limiting via Supabase ─────────────────────────────────
  const weekKey      = getISOWeekKey()
  const rateLimitKey = hashValue(deviceToken + weekKey)

  const supabase = createClient()
  const { data: rlData, error: rlError } = await supabase
    .rpc('increment_sams_rate_limit', {
      p_ip_hash:  rateLimitKey,
      p_week_key: weekKey,
    })

  if (rlError) {
    console.error('[sams/query] rate-limit RPC error:', rlError.message)
    // Fail open — don't block the site if the table isn't migrated yet
  } else {
    const count     = (rlData as number) ?? 0
    const remaining = Math.max(0, RATE_LIMIT - count)

    if (count > RATE_LIMIT) {
      const resp = NextResponse.json(
        { error: 'Weekly limit reached. Come back next Monday!', remaining: 0 },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
      if (isNewToken) setDeviceCookie(resp, deviceToken)
      return resp
    }

    // ── Forward to Sams backend ──────────────────────────────────────────────
    try {
      const upstreamBody: Record<string, unknown> = {
        query,
        match_count: matchCount,
      }
      // Only include history if there is any — keeps payloads lean for first messages
      if (conversationHistory && conversationHistory.length > 0) {
        upstreamBody.conversation_history = conversationHistory
      }

      const upstream = await fetch(`${API_BASE}/api/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(upstreamBody),
      })

      const json = await upstream.json()
      const resp = NextResponse.json(
        { ...json, remaining },
        {
          status:  upstream.status,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        }
      )
      if (isNewToken) setDeviceCookie(resp, deviceToken)
      return resp
    } catch (err) {
      console.error('[sams/query] upstream error:', err)
      const resp = NextResponse.json(
        { error: 'Could not reach Sams backend.' },
        { status: 502 }
      )
      if (isNewToken) setDeviceCookie(resp, deviceToken)
      return resp
    }
  }

  // ── Fallback (rate-limit table not yet migrated) ───────────────────────────
  try {
    const upstreamBody: Record<string, unknown> = { query, match_count: matchCount }
    if (conversationHistory && conversationHistory.length > 0) {
      upstreamBody.conversation_history = conversationHistory
    }

    const upstream = await fetch(`${API_BASE}/api/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(upstreamBody),
    })
    const json = await upstream.json()
    const resp = NextResponse.json(json, { status: upstream.status })
    if (isNewToken) setDeviceCookie(resp, deviceToken)
    return resp
  } catch {
    return NextResponse.json({ error: 'Could not reach Sams backend.' }, { status: 502 })
  }
}

// ─── Cookie helper ────────────────────────────────────────────────────────────

function setDeviceCookie(response: NextResponse, token: string): void {
  response.cookies.set('sams_device', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 365,
    path:     '/api/sams',
  })
}
