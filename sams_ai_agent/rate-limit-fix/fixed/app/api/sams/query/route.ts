import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const RATE_LIMIT = 10
const API_BASE   = process.env.SAMS_API_URL

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { error: 'Sams AI is not configured on this server.' },
      { status: 503 }
    )
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  let query: string
  let matchCount: number
  let fingerprint: string | null

  try {
    const body = await request.json()
    query       = typeof body?.query === 'string' ? body.query.trim() : ''
    matchCount  = typeof body?.match_count === 'number' ? body.match_count : 5
    fingerprint = typeof body?.fingerprint === 'string' ? body.fingerprint : null
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
  //
  //  Priority:
  //   1. HttpOnly cookie  — set on first visit, invisible to JS (primary key)
  //   2. Browser fingerprint + IP hash — fallback if cookie was cleared
  //   3. Random UUID  — last resort (new device, no fingerprint sent)
  //
  //  The cookie stores the token so the SAME token is reused on every request,
  //  keeping the rate-limit key stable across the week.

  const existingCookie = request.cookies.get('sams_device')?.value
  let deviceToken: string
  let isNewToken = false

  if (existingCookie) {
    // Happy path — cookie present, reuse it
    deviceToken = existingCookie
  } else if (fingerprint) {
    // Cookie was cleared or this is a new incognito tab — derive a stable
    // token from the fingerprint so the same device hits the same bucket
    deviceToken = hashValue(fingerprint + getClientIP(request))
    isNewToken  = true
  } else {
    // No cookie and no fingerprint — generate a fresh random token
    deviceToken = crypto.randomUUID()
    isNewToken  = true
  }

  // ── Server-side rate limiting via Supabase ─────────────────────────────────
  //  The stored key is hash(deviceToken + weekKey) — never raw token or IP
  const weekKey      = getISOWeekKey()
  const rateLimitKey = hashValue(deviceToken + weekKey)

  const supabase = createClient()
  const { data: rlData, error: rlError } = await supabase
    .rpc('increment_sams_rate_limit', {
      p_ip_hash:  rateLimitKey,  // column name is legacy; stores device hash
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
      const upstream = await fetch(`${API_BASE}/api/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query, match_count: matchCount }),
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
    const upstream = await fetch(`${API_BASE}/api/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, match_count: matchCount }),
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
    httpOnly: true,                               // invisible to JavaScript
    sameSite: 'strict',                           // no cross-site sending
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 365,                // 1 year
    path:     '/api/sams',                        // scoped to this route only
  })
}
