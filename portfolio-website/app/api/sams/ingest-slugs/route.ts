import { createClient }              from '@/lib/supabase/server'
import { NextRequest, NextResponse }  from 'next/server'

/**
 * GET /api/sams/ingest-slugs
 *
 * Admin-gated proxy that returns a summary of every slug currently in the
 * vector store: volatility, version, last_updated, status, chunk count,
 * and last ingestion timestamp.
 *
 * Calls GET /api/ingest/slugs on the Sams AI backend.
 */
export async function GET(request: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const upstream = await fetch(`${apiBase}/api/ingest/slugs`, {
      method:  'GET',
      headers: { 'X-API-Key': ingestApiKey },
    })

    const json = await upstream.json()
    return NextResponse.json(json, { status: upstream.status })
  } catch (err: unknown) {
    console.error('[sams/ingest-slugs] upstream error:', err)
    return NextResponse.json(
      { error: 'Failed to reach Sams backend.' },
      { status: 502 }
    )
  }
}
