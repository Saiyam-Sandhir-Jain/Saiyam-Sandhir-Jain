import { createClient }   from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/sams/ingest
 *
 * Admin-gated proxy that forwards a .txt file upload to the Sams AI backend.
 * Keeps the Sams API URL and ingest API key server-side only (not exposed to the browser bundle).
 */
export async function POST(request: NextRequest) {
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

  // ── Forward multipart form data to Sams backend ─────────────────────────────
  try {
    const formData = await request.formData()

    const upstream = await fetch(`${apiBase}/api/ingest`, {
      method: 'POST',
      body:   formData,
      headers: {
        'X-API-Key': ingestApiKey,
        // Do NOT set Content-Type — let fetch set the multipart boundary automatically
      },
    })

    const json = await upstream.json()

    return NextResponse.json(json, { status: upstream.status })
  } catch (err: unknown) {
    console.error('[sams/ingest] upstream error:', err)
    return NextResponse.json(
      { error: 'Failed to reach Sams backend.' },
      { status: 502 }
    )
  }
}
