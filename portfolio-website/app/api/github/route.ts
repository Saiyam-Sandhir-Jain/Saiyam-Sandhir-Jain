/**
 * app/api/github/route.ts
 */

import { NextResponse } from 'next/server'

const GH_USER = 'Saiyam-Sandhir-Jain'

// Shared cache window (seconds). Matches the old client-side repo TTL.
const REVALIDATE_SECONDS = 60 * 60

export async function GET() {
  try {
    const ghHeaders: HeadersInit = { Accept: 'application/vnd.github+json' }
    if (process.env.GITHUB_TOKEN) {
      ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const [contribRes, reposRes] = await Promise.all([
      fetch(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`, {
        next: { revalidate: REVALIDATE_SECONDS },
      }),
      fetch(`https://api.github.com/users/${GH_USER}/repos?sort=updated&per_page=40&type=public`, {
        headers: ghHeaders,
        next: { revalidate: REVALIDATE_SECONDS },
      }),
    ])

    if (!contribRes.ok || !reposRes.ok) {
      return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })
    }

    const [contrib, repos] = await Promise.all([contribRes.json(), reposRes.json()])

    return NextResponse.json({ contrib, repos })
  } catch {
    return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })
  }
}
