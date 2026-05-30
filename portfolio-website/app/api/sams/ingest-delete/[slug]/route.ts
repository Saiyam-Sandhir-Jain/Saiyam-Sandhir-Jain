import { createClient }          from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/sams/ingest-delete/[slug]
 *
 * Admin-gated proxy that deletes all vector store chunks for a given slug
 * by calling DELETE /api/ingest/{slug} on the Sams AI backend.
 *
 * Used from the admin UI to manually remove a file from the knowledge base
 * before re-ingesting, or to delete a file entirely.
 */
export async function DELETE(
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
  if (!slug || !slug.trim()) {
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
    const upstream = await fetch(`${apiBase}/api/ingest/${encodeURIComponent(slug)}`, {
      method:  'DELETE',
      headers: { 'X-API-Key': ingestApiKey },
    })

    const json = await upstream.json()
    return NextResponse.json(json, { status: upstream.status })
  } catch (err: unknown) {
    console.error('[sams/ingest-delete] upstream error:', err)
    return NextResponse.json(
      { error: 'Failed to reach Sams backend.' },
      { status: 502 }
    )
  }
}
