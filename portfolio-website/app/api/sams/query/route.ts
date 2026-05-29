import { createClient, createServiceClient } from '@/lib/supabase/server'
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

      // Persist chat history (fire-and-forget — never blocks the response)
      if (upstream.ok && typeof json.answer === 'string') {
        saveChatTurn(deviceToken, query, json.answer)
      }

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

    // Persist chat history even in the fallback path
    if (upstream.ok && typeof json.answer === 'string') {
      saveChatTurn(deviceToken, query, json.answer)
    }

    return resp
  } catch {
    return NextResponse.json({ error: 'Could not reach Sams backend.' }, { status: 502 })
  }
}

// ─── Chat history helper ──────────────────────────────────────────────────────

/**
 * Persists a user→assistant exchange to chat_sessions / chat_messages.
 * Fire-and-forget — errors are logged but never surface to the caller.
 *
 * Uses the service-role client to bypass RLS — chat_sessions and
 * chat_messages have no anon write policy, so the regular anon client
 * would silently fail on every insert.
 */
async function saveChatTurn(
  deviceToken: string,
  userQuery: string,
  assistantAnswer: string,
): Promise<void> {
  // Service client bypasses RLS — required because anon has no write policy
  // on chat_sessions / chat_messages.
  const supabase = createServiceClient()
  try {
    // Upsert session: find existing open session for this device (active in last 30 min)
    // or create a new one.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('device_token', deviceToken)
      .gte('last_active', thirtyMinAgo)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()

    let sessionId: string

    if (existing?.id) {
      sessionId = existing.id
      // bump last_active
      await supabase
        .from('chat_sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', sessionId)
    } else {
      const { data: newSession, error: sessionErr } = await supabase
        .from('chat_sessions')
        .insert({ device_token: deviceToken })
        .select('id')
        .single()
      if (sessionErr || !newSession) {
        console.error('[sams/chat_history] session insert error:', sessionErr?.message)
        return
      }
      sessionId = newSession.id
    }

    // Insert user message then assistant message
    await supabase.from('chat_messages').insert([
      { session_id: sessionId, role: 'user',      content: userQuery },
      { session_id: sessionId, role: 'assistant', content: assistantAnswer },
    ])
  } catch (err) {
    console.error('[sams/chat_history] unexpected error:', err)
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
