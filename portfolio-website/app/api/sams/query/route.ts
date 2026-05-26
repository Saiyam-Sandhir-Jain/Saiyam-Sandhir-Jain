import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const RATE_LIMIT = 10
const API_BASE   = process.env.SAMS_API_URL  // server-side only — never sent to browser

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

function hashIP(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? 'sams-default-salt'
  return crypto.createHash('sha256').update(ip + salt).digest('hex').slice(0, 32)
}

function getClientIP(request: NextRequest): string {
  // Vercel / proxied environments set x-forwarded-for
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

  try {
    const body = await request.json()
    query = typeof body?.query === 'string' ? body.query.trim() : ''
    matchCount = typeof body?.match_count === 'number' ? body.match_count : 5
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!query || query.length > 1000) {
    return NextResponse.json(
      { error: 'Query must be between 1 and 1000 characters.' },
      { status: 400 }
    )
  }

  // ── Server-side rate limiting via Supabase ────────────────────────────────
  const ipHash  = hashIP(getClientIP(request))
  const weekKey = getISOWeekKey()

  const supabase = createClient()

  // Upsert: insert row or increment count atomically via RPC
  const { data: rlData, error: rlError } = await supabase
    .rpc('increment_sams_rate_limit', { p_ip_hash: ipHash, p_week_key: weekKey })

  if (rlError) {
    // If the table / function isn't set up yet, fail open so the site keeps
    // working — but log the issue.
    console.error('[sams/query] rate-limit RPC error:', rlError.message)
  } else {
    const count = (rlData as number) ?? 0
    const remaining = Math.max(0, RATE_LIMIT - count)

    if (count > RATE_LIMIT) {
      return NextResponse.json(
        {
          error:     'Weekly limit reached. Come back next Monday!',
          remaining: 0,
        },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': '0' },
        }
      )
    }

    // Attach remaining count to response headers so the client can stay in sync
    const headers = new Headers({ 'X-RateLimit-Remaining': String(remaining) })

    // ── Forward to Sams backend ─────────────────────────────────────────────
    try {
      const upstream = await fetch(`${API_BASE}/api/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query, match_count: matchCount }),
      })

      const json = await upstream.json()
      return NextResponse.json({ ...json, remaining }, { status: upstream.status, headers })
    } catch (err) {
      console.error('[sams/query] upstream error:', err)
      return NextResponse.json(
        { error: 'Could not reach Sams backend.' },
        { status: 502, headers }
      )
    }
  }

  // Fallback if rate-limit table not yet migrated — still proxy the request
  try {
    const upstream = await fetch(`${API_BASE}/api/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, match_count: matchCount }),
    })
    const json = await upstream.json()
    return NextResponse.json(json, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'Could not reach Sams backend.' }, { status: 502 })
  }
}
