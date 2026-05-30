import { createClient }              from '@/lib/supabase/server'
import { NextRequest, NextResponse }  from 'next/server'

/**
 * PATCH /api/sams/ingest-update/[slug]
 *
 * Admin-gated proxy that merges metadata fields (volatility, version,
 * last_updated, status) onto every chunk for a given slug — without
 * touching the embeddings or chunk text.
 *
 * Body (JSON):
 *   volatility?   – "frozen" | "slow" | "live"
 *   version?      – integer ≥ 1
 *   last_updated? – "YYYY-MM"
 *   status?       – e.g. "completed" | "ongoing" | "published"
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = params
  if (!slug?.trim()) {
    return NextResponse.json({ error: 'slug is required.' }, { status: 400 })
  }

  const apiBase = process.env.SAMS_API_URL
  if (!apiBase) {
    return NextResponse.json(
      { error: 'SAMS_API_URL is not configured on the server.' },
      { status: 500 }
    )
  }

  const ingestApiKey = process.env.SAMS_INGEST_API_KEY
  if (!ingestApiKey) {
    return NextResponse.json(
      { error: 'SAMS_INGEST_API_KEY is not configured on the server.' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()

    const upstream = await fetch(`${apiBase}/api/ingest/${encodeURIComponent(slug)}`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    ingestApiKey,
      },
      body: JSON.stringify(body),
    })

    const json = await upstream.json()
    return NextResponse.json(json, { status: upstream.status })
  } catch (err: unknown) {
    console.error('[sams/ingest-update] upstream error:', err)
    return NextResponse.json(
      { error: 'Failed to reach Sams backend.' },
      { status: 502 }
    )
  }
}
