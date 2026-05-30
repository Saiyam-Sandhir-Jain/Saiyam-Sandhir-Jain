'use client'

import { useState, useRef } from 'react'
import { uploadSamsAvatar, deleteSamsAvatar } from '../_actions/sams'

interface SamsManagerProps {
  samsAvatarUrl?: string | null
}

// ─── Shared button styles ─────────────────────────────────────────────────────
const btnPrimary =
  'px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors disabled:opacity-50'
const btnDanger =
  'px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 text-xs font-medium transition-colors disabled:opacity-50'

// ─── Accepted file types ──────────────────────────────────────────────────────
const ACCEPTED_EXTENSIONS = [
  '.txt', '.md', '.markdown',
  '.csv', '.tsv', '.log', '.yaml', '.yml', '.json', '.html', '.htm', '.rst', '.xml',
  '.pdf',
  '.docx',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
]
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')
const ACCEPTED_SET = new Set(ACCEPTED_EXTENSIONS)

// ─── Volatility config ────────────────────────────────────────────────────────
type Volatility = 'frozen' | 'slow' | 'live'

const VOLATILITY_OPTIONS: { value: Volatility; label: string; description: string; color: string }[] = [
  {
    value: 'frozen',
    label: 'Frozen',
    description: 'Never changes — certs, patents, LORs, awards.',
    color: '#60a5fa',   // blue
  },
  {
    value: 'slow',
    label: 'Slow',
    description: 'Changes per semester — education, research, experience.',
    color: '#a78bfa',  // purple
  },
  {
    value: 'live',
    label: 'Live',
    description: 'Changes frequently — projects, skills, contact, identity.',
    color: '#4ade80',  // green
  },
]

const VOLATILITY_COLOR: Record<string, string> = {
  frozen: '#60a5fa',
  slow:   '#a78bfa',
  live:   '#4ade80',
}

// ─── Ingest result type ───────────────────────────────────────────────────────
interface IngestResult {
  filename:       string
  total_chunks?:  number
  deleted_chunks?: number
  slug?:          string
  volatility?:    string
  message?:       string
  error?:         string
}

// ─── Slug browser types ───────────────────────────────────────────────────────
interface SlugSummary {
  slug:         string
  volatility:   string | null
  version:      number | null
  last_updated: string | null
  status:       string | null
  chunk_count:  number
  ingested_at:  string | null
}

interface SlugPatch {
  volatility?:   string
  version?:      number
  last_updated?: string
  status?:       string
}

export function SamsManager({ samsAvatarUrl: initialAvatarUrl }: SamsManagerProps) {
  // ── Avatar state ──────────────────────────────────────────────────────────
  const [avatarUrl,     setAvatarUrl]     = useState(initialAvatarUrl ?? '')
  const [avatarStatus,  setAvatarStatus]  = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Ingestion state ───────────────────────────────────────────────────────
  const [ingestFiles,    setIngestFiles]    = useState<FileList | null>(null)
  const [ingestStatus,   setIngestStatus]   = useState('')
  const [ingestLoading,  setIngestLoading]  = useState(false)
  const [ingestResults,  setIngestResults]  = useState<IngestResult[]>([])
  const ingestInputRef = useRef<HTMLInputElement>(null)

  // ── Volatility metadata state (for .md KB files) ──────────────────────────
  const [showVolatility,  setShowVolatility]  = useState(false)
  const [slug,            setSlug]            = useState('')
  const [volatility,      setVolatility]      = useState<Volatility>('slow')
  const [version,         setVersion]         = useState(1)
  const [lastUpdated,     setLastUpdated]      = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // ── Delete-by-slug state ──────────────────────────────────────────────────
  const [deleteSlug,    setDeleteSlug]    = useState('')
  const [deleteStatus,  setDeleteStatus]  = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Slug browser state ────────────────────────────────────────────────────
  const [slugList,      setSlugList]      = useState<SlugSummary[]>([])
  const [slugsLoading,  setSlugsLoading]  = useState(false)
  const [slugsStatus,   setSlugsStatus]   = useState('')
  const [editingSlug,   setEditingSlug]   = useState<string | null>(null)
  const [editPatch,     setEditPatch]     = useState<SlugPatch>({})
  const [patchLoading,  setPatchLoading]  = useState(false)
  const [patchStatus,   setPatchStatus]   = useState<Record<string, string>>({})

  // ── Avatar handlers ───────────────────────────────────────────────────────
  const handleAvatarUpload = async () => {
    const file = avatarInputRef.current?.files?.[0]
    if (!file) return
    setAvatarLoading(true); setAvatarStatus('')
    try {
      const fd = new FormData()
      fd.append('sams_avatar', file)
      const res = await uploadSamsAvatar(fd)
      setAvatarUrl(res.url!)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
      setAvatarStatus('✓ Sams avatar updated.')
    } catch (err: any) {
      setAvatarStatus(`✗ ${err.message}`)
    } finally { setAvatarLoading(false) }
  }

  const handleAvatarDelete = async () => {
    if (!confirm('Remove Sams avatar? The default icon will be used.')) return
    setAvatarLoading(true); setAvatarStatus('')
    try {
      await deleteSamsAvatar()
      setAvatarUrl('')
      setAvatarStatus('✓ Avatar removed.')
    } catch (err: any) {
      setAvatarStatus(`✗ ${err.message}`)
    } finally { setAvatarLoading(false) }
  }

  // ── Ingestion handler ─────────────────────────────────────────────────────
  const handleIngest = async () => {
    if (!ingestFiles || ingestFiles.length === 0) {
      setIngestStatus('Please select one or more files.')
      return
    }

    for (let i = 0; i < ingestFiles.length; i++) {
      const ext = '.' + (ingestFiles[i].name.split('.').pop()?.toLowerCase() ?? '')
      if (!ACCEPTED_SET.has(ext)) {
        setIngestStatus(`✗ "${ingestFiles[i].name}" has an unsupported file type.`)
        return
      }
    }

    const useVolatility = showVolatility
    if (useVolatility && !slug.trim()) {
      setIngestStatus('✗ Slug is required when volatility metadata is enabled.')
      return
    }
    if (useVolatility && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug.trim())) {
      setIngestStatus('✗ Slug must be lowercase letters, numbers, and hyphens only.')
      return
    }

    setIngestLoading(true)
    setIngestStatus(`Ingesting ${ingestFiles.length} file(s)…`)
    setIngestResults([])

    const results: IngestResult[] = []

    for (let i = 0; i < ingestFiles.length; i++) {
      const file = ingestFiles[i]
      setIngestStatus(`Ingesting ${i + 1} / ${ingestFiles.length}: ${file.name}…`)

      try {
        const fd = new FormData()
        fd.append('file', file)

        if (useVolatility) {
          fd.append('slug',         slug.trim())
          fd.append('volatility',   volatility)
          fd.append('version',      String(version))
          fd.append('last_updated', lastUpdated)
        }

        const res  = await fetch('/api/sams/ingest', { method: 'POST', body: fd })
        const json = await res.json()

        if (res.ok) {
          results.push({
            filename:       json.filename ?? file.name,
            total_chunks:   json.total_chunks,
            deleted_chunks: json.deleted_chunks,
            slug:           json.slug,
            volatility:     json.volatility,
            message:        json.message ?? 'Ingestion complete.',
          })
        } else {
          results.push({ filename: file.name, error: json.detail ?? json.error ?? `HTTP ${res.status}` })
        }
      } catch (err: any) {
        results.push({ filename: file.name, error: err.message ?? 'Network error' })
      }
    }

    setIngestResults(results)
    const failed = results.filter(r => r.error).length
    setIngestStatus(
      failed === 0
        ? `✓ All ${results.length} file(s) ingested successfully.`
        : `⚠ ${results.length - failed} succeeded, ${failed} failed.`
    )
    setIngestLoading(false)
    if (ingestInputRef.current) ingestInputRef.current.value = ''
    setIngestFiles(null)

    if (useVolatility && failed === 0) setVersion(v => v + 1)
  }

  // ── Delete-by-slug handler ────────────────────────────────────────────────
  const handleDeleteBySlug = async () => {
    const s = deleteSlug.trim()
    if (!s) { setDeleteStatus('✗ Enter a slug to delete.'); return }
    if (!confirm(`Delete all chunks for slug "${s}"? This cannot be undone.`)) return

    setDeleteLoading(true); setDeleteStatus('')
    try {
      const res  = await fetch(`/api/sams/ingest-delete/${encodeURIComponent(s)}`, { method: 'DELETE' })
      const json = await res.json()
      if (res.ok) {
        setDeleteStatus(`✓ Deleted ${json.deleted_chunks ?? 0} chunk(s) for "${s}".`)
        setDeleteSlug('')
        // Remove from slug list if loaded
        setSlugList(prev => prev.filter(sl => sl.slug !== s))
      } else {
        setDeleteStatus(`✗ ${json.detail ?? json.error ?? `HTTP ${res.status}`}`)
      }
    } catch (err: any) {
      setDeleteStatus(`✗ ${err.message ?? 'Network error'}`)
    } finally { setDeleteLoading(false) }
  }

  // ── Slug browser handlers ─────────────────────────────────────────────────
  const handleLoadSlugs = async () => {
    setSlugsLoading(true); setSlugsStatus(''); setSlugList([])
    try {
      const res  = await fetch('/api/sams/ingest-slugs')
      const json = await res.json()
      if (res.ok) {
        setSlugList(json.slugs ?? [])
        setSlugsStatus(
          json.total === 0
            ? 'No slugs found in the knowledge base.'
            : `✓ Loaded ${json.total} slug(s).`
        )
      } else {
        setSlugsStatus(`✗ ${json.detail ?? json.error ?? `HTTP ${res.status}`}`)
      }
    } catch (err: any) {
      setSlugsStatus(`✗ ${err.message ?? 'Network error'}`)
    } finally { setSlugsLoading(false) }
  }

  const startEdit = (s: SlugSummary) => {
    setEditingSlug(s.slug)
    setEditPatch({
      volatility:   s.volatility   ?? undefined,
      version:      s.version      ?? undefined,
      last_updated: s.last_updated ?? undefined,
      status:       s.status       ?? undefined,
    })
    setPatchStatus(prev => ({ ...prev, [s.slug]: '' }))
  }

  const cancelEdit = () => {
    setEditingSlug(null)
    setEditPatch({})
  }

  const handlePatchSave = async (targetSlug: string) => {
    // Only send fields that are non-empty
    const payload: SlugPatch = {}
    if (editPatch.volatility)   payload.volatility   = editPatch.volatility
    if (editPatch.version)      payload.version      = editPatch.version
    if (editPatch.last_updated) payload.last_updated = editPatch.last_updated
    if (editPatch.status !== undefined) payload.status = editPatch.status  // allow empty string to clear

    if (Object.keys(payload).length === 0) {
      setPatchStatus(prev => ({ ...prev, [targetSlug]: '✗ No changes to save.' }))
      return
    }

    setPatchLoading(true)
    try {
      const res  = await fetch(`/api/sams/ingest-update/${encodeURIComponent(targetSlug)}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (res.ok) {
        setPatchStatus(prev => ({
          ...prev,
          [targetSlug]: `✓ Updated ${json.updated_chunks ?? 0} chunk(s).`,
        }))
        // Reflect changes in the local list
        setSlugList(prev =>
          prev.map(s =>
            s.slug === targetSlug
              ? {
                  ...s,
                  volatility:   payload.volatility   ?? s.volatility,
                  version:      payload.version      ?? s.version,
                  last_updated: payload.last_updated ?? s.last_updated,
                  status:       payload.status       !== undefined ? payload.status : s.status,
                }
              : s
          )
        )
        setEditingSlug(null)
        setEditPatch({})
      } else {
        setPatchStatus(prev => ({
          ...prev,
          [targetSlug]: `✗ ${json.detail ?? json.error ?? `HTTP ${res.status}`}`,
        }))
      }
    } catch (err: any) {
      setPatchStatus(prev => ({
        ...prev,
        [targetSlug]: `✗ ${err.message ?? 'Network error'}`,
      }))
    } finally { setPatchLoading(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Section: Sams Avatar ── */}
      <div
        className="p-5 rounded-xl border border-zinc-700/60"
        style={{ backgroundColor: '#1c1a18' }}
      >
        <h3 className="text-white font-semibold text-sm mb-1">Sams AI Avatar</h3>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Upload a photo that appears inside the circle in the chat panel. Recommended: 256×256px or larger, square crop. Stored in Supabase Storage.
        </p>

        <div className="flex items-start gap-4">
          {/* Preview */}
          <div
            className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-700"
            style={{ backgroundColor: avatarUrl ? 'transparent' : '#FF4500' }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Sams avatar"
                className="w-full h-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span className="text-white text-xs font-bold">AI</span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={e => {
                if (e.target.files?.[0]) setTimeout(handleAvatarUpload, 0)
              }}
              className="hidden"
              id="sams-avatar-input"
            />
            <div className="flex gap-2 flex-wrap">
              <label
                htmlFor="sams-avatar-input"
                className={`${btnPrimary} cursor-pointer`}
                style={{ opacity: avatarLoading ? 0.5 : 1, pointerEvents: avatarLoading ? 'none' : 'auto' }}
              >
                {avatarUrl ? 'Replace Photo' : 'Upload Photo'}
              </label>
              {avatarUrl && (
                <button onClick={handleAvatarDelete} disabled={avatarLoading} className={btnDanger}>
                  Remove
                </button>
              )}
            </div>
            {avatarStatus && (
              <p className="text-xs mt-1" style={{ color: avatarStatus.startsWith('✓') ? '#4ade80' : '#f87171' }}>
                {avatarStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Knowledge Base Ingestion ── */}
      <div
        className="p-5 rounded-xl border border-zinc-700/60"
        style={{ backgroundColor: '#1c1a18' }}
      >
        <h3 className="text-white font-semibold text-sm mb-1">Knowledge Base — Ingestion</h3>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Upload files to add them to Sams' knowledge base. Supported:{' '}
          <code className="bg-zinc-800 px-1 rounded text-zinc-300">.txt .md .pdf .docx</code>,
          images (<code className="bg-zinc-800 px-1 rounded text-zinc-300">.jpg .png .webp .gif</code>),
          and data files (<code className="bg-zinc-800 px-1 rounded text-zinc-300">.csv .json .yaml</code> and more).
          For <code className="bg-zinc-800 px-1 rounded text-zinc-300">.md</code> knowledge-base files,
          enable volatility metadata to support targeted re-ingestion.
        </p>

        <div className="space-y-4">

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
            onClick={() => ingestInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,69,0,0.6)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '' }}
            onDrop={e => {
              e.preventDefault()
              e.currentTarget.style.borderColor = ''
              setIngestFiles(e.dataTransfer.files)
            }}
          >
            <input
              ref={ingestInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="hidden"
              onChange={e => setIngestFiles(e.target.files)}
            />
            <svg className="mx-auto mb-2 text-zinc-600" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-zinc-400 text-sm">
              {ingestFiles && ingestFiles.length > 0
                ? `${ingestFiles.length} file(s) selected`
                : 'Click or drag files here'}
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              .txt · .md · .pdf · .docx · .jpg · .png · .webp · .gif · .csv · .json · .yaml · and more
            </p>
          </div>

          {/* Volatility metadata toggle */}
          <div
            className="rounded-lg border border-zinc-700/50 overflow-hidden"
            style={{ backgroundColor: '#161412' }}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => setShowVolatility(v => !v)}
            >
              <div className="flex items-center gap-2">
                <span className="text-zinc-300 text-xs font-medium">Volatility Metadata</span>
                <span className="text-zinc-600 text-xs">— for .md knowledge-base files</span>
              </div>
              <div className="flex items-center gap-2">
                {showVolatility && slug && (
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                    style={{
                      color: VOLATILITY_COLOR[volatility],
                      borderColor: VOLATILITY_COLOR[volatility] + '40',
                      backgroundColor: VOLATILITY_COLOR[volatility] + '12',
                    }}
                  >
                    {volatility} · {slug} · v{version}
                  </span>
                )}
                <svg
                  className="text-zinc-500 transition-transform"
                  style={{ transform: showVolatility ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {showVolatility && (
              <div className="px-4 pb-4 space-y-4 border-t border-zinc-700/50">

                {/* Volatility tier selector */}
                <div className="mt-4">
                  <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-2">
                    Volatility Tier
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {VOLATILITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setVolatility(opt.value)}
                        className="p-3 rounded-lg border text-left transition-all"
                        style={{
                          borderColor:     volatility === opt.value ? opt.color + '60' : '#3f3f46',
                          backgroundColor: volatility === opt.value ? opt.color + '12' : 'transparent',
                        }}
                      >
                        <div className="text-xs font-medium mb-1" style={{ color: opt.color }}>
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-zinc-500 leading-snug">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  {volatility === 'frozen' && (
                    <p className="text-[11px] text-blue-400/70 mt-2">
                      Frozen files are write-once. Existing chunks will NOT be deleted before inserting — use only for initial ingestion of certs, patents, and LORs.
                    </p>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                    Slug <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="e.g. manifestai"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/60"
                  />
                  <p className="text-zinc-600 text-[10px] mt-1">
                    Stable identifier for this file. Must match the slug used in RELATIONS.md.
                    {volatility !== 'frozen' && slug && ' Existing chunks for this slug will be deleted before inserting.'}
                  </p>
                </div>

                {/* Version + Last updated */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                      Version
                    </label>
                    <input
                      type="number"
                      value={version}
                      min={1}
                      onChange={e => setVersion(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/60"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                      Last Updated
                    </label>
                    <input
                      type="month"
                      value={lastUpdated}
                      onChange={e => setLastUpdated(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/60"
                    />
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Ingest button */}
          <button
            onClick={handleIngest}
            disabled={ingestLoading || !ingestFiles || ingestFiles.length === 0}
            className={btnPrimary}
          >
            {ingestLoading ? 'Ingesting…' : 'Ingest into Knowledge Base'}
          </button>

          {ingestStatus && (
            <p
              className="text-xs"
              style={{
                color: ingestStatus.startsWith('✓')
                  ? '#4ade80'
                  : ingestStatus.startsWith('✗') || ingestStatus.startsWith('⚠')
                  ? '#f87171'
                  : '#a1a1aa',
              }}
            >
              {ingestStatus}
            </p>
          )}
        </div>

        {/* Results table */}
        {ingestResults.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-zinc-500 text-[11px] font-medium uppercase tracking-wider mb-2">Results</p>
            {ingestResults.map((r, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: r.error ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.06)',
                  border: `1px solid ${r.error ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.15)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ color: r.error ? '#f87171' : '#4ade80' }}>{r.error ? '✗' : '✓'}</span>
                  <span className="font-mono text-zinc-300 flex-1 truncate">{r.filename}</span>
                  {r.total_chunks !== undefined && (
                    <span className="text-zinc-500">{r.total_chunks} chunks</span>
                  )}
                  {r.volatility && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        color: VOLATILITY_COLOR[r.volatility] ?? '#a1a1aa',
                        backgroundColor: (VOLATILITY_COLOR[r.volatility] ?? '#a1a1aa') + '18',
                      }}
                    >
                      {r.volatility}
                    </span>
                  )}
                  {r.error && <span className="text-red-400">{r.error}</span>}
                </div>
                {!r.error && r.deleted_chunks !== undefined && r.deleted_chunks > 0 && (
                  <p className="text-zinc-600 text-[10px] mt-1 pl-5">
                    Replaced {r.deleted_chunks} previous chunk(s) for slug "{r.slug}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section: Manage Slugs ── */}
      <div
        className="p-5 rounded-xl border border-zinc-700/60"
        style={{ backgroundColor: '#1c1a18' }}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-white font-semibold text-sm">Knowledge Base — Manage Slugs</h3>
          <button
            onClick={handleLoadSlugs}
            disabled={slugsLoading}
            className={btnSecondary + ' text-xs px-3 py-1.5'}
          >
            {slugsLoading ? 'Loading…' : slugList.length > 0 ? 'Refresh' : 'Load Slugs'}
          </button>
        </div>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Browse every slug currently in the vector store and update their metadata in-place —
          no re-embedding needed. Use this to mark a completed project as{' '}
          <code className="bg-zinc-800 px-1 rounded text-zinc-300">frozen</code>, change a
          volatility tier, or update a status without touching the chunk text.
        </p>

        {slugsStatus && (
          <p
            className="text-xs mb-3"
            style={{ color: slugsStatus.startsWith('✓') ? '#4ade80' : slugsStatus.startsWith('✗') ? '#f87171' : '#a1a1aa' }}
          >
            {slugsStatus}
          </p>
        )}

        {slugList.length > 0 && (
          <div className="space-y-2">
            {slugList.map(s => {
              const isEditing = editingSlug === s.slug
              const vColor    = VOLATILITY_COLOR[s.volatility ?? ''] ?? '#71717a'

              return (
                <div
                  key={s.slug}
                  className="rounded-lg border border-zinc-700/50 overflow-hidden"
                  style={{ backgroundColor: '#161412' }}
                >
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Slug pill */}
                    <span className="font-mono text-zinc-200 text-xs flex-1 truncate">{s.slug}</span>

                    {/* Volatility badge */}
                    {s.volatility && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                        style={{
                          color:           vColor,
                          borderColor:     vColor + '40',
                          backgroundColor: vColor + '12',
                        }}
                      >
                        {s.volatility}
                      </span>
                    )}

                    {/* Status badge */}
                    {s.status && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-600/50 text-zinc-400 bg-zinc-800/50 shrink-0">
                        {s.status}
                      </span>
                    )}

                    {/* Chunk count */}
                    <span className="text-zinc-600 text-[10px] shrink-0">{s.chunk_count} chunks</span>

                    {/* Edit / Cancel toggle */}
                    <button
                      onClick={() => isEditing ? cancelEdit() : startEdit(s)}
                      disabled={patchLoading && isEditing}
                      className="text-[11px] px-2.5 py-1 rounded border transition-colors shrink-0"
                      style={{
                        borderColor:     isEditing ? '#f87171' + '40' : '#3f3f46',
                        color:           isEditing ? '#f87171'        : '#a1a1aa',
                        backgroundColor: isEditing ? '#f8717112'      : 'transparent',
                      }}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Inline editor */}
                  {isEditing && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-700/50 space-y-4">

                      {/* Volatility selector */}
                      <div>
                        <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-2">
                          Volatility Tier
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {VOLATILITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setEditPatch(p => ({ ...p, volatility: opt.value }))}
                              className="p-2.5 rounded-lg border text-left transition-all"
                              style={{
                                borderColor:     editPatch.volatility === opt.value ? opt.color + '60' : '#3f3f46',
                                backgroundColor: editPatch.volatility === opt.value ? opt.color + '12' : 'transparent',
                              }}
                            >
                              <div className="text-xs font-medium" style={{ color: opt.color }}>
                                {opt.label}
                              </div>
                              <div className="text-[9px] text-zinc-500 leading-snug mt-0.5">
                                {opt.description}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status + Version + Last updated */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                            Status
                          </label>
                          <input
                            type="text"
                            value={editPatch.status ?? ''}
                            onChange={e => setEditPatch(p => ({ ...p, status: e.target.value }))}
                            placeholder="e.g. completed"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/60"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                            Version
                          </label>
                          <input
                            type="number"
                            value={editPatch.version ?? ''}
                            min={1}
                            onChange={e => setEditPatch(p => ({
                              ...p,
                              version: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined,
                            }))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500/60"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
                            Last Updated
                          </label>
                          <input
                            type="month"
                            value={editPatch.last_updated ?? ''}
                            onChange={e => setEditPatch(p => ({ ...p, last_updated: e.target.value || undefined }))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500/60"
                          />
                        </div>
                      </div>

                      {/* Save button + status */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePatchSave(s.slug)}
                          disabled={patchLoading}
                          className={btnPrimary + ' text-xs px-3 py-1.5'}
                        >
                          {patchLoading ? 'Saving…' : 'Save Changes'}
                        </button>
                        {patchStatus[s.slug] && (
                          <p
                            className="text-xs"
                            style={{
                              color: patchStatus[s.slug].startsWith('✓') ? '#4ade80' : '#f87171',
                            }}
                          >
                            {patchStatus[s.slug]}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Non-editing patch status (persists after save) */}
                  {!isEditing && patchStatus[s.slug] && (
                    <div className="px-4 pb-2.5 border-t border-zinc-700/30">
                      <p
                        className="text-[11px] mt-2"
                        style={{
                          color: patchStatus[s.slug].startsWith('✓') ? '#4ade80' : '#f87171',
                        }}
                      >
                        {patchStatus[s.slug]}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section: Delete by Slug ── */}
      <div
        className="p-5 rounded-xl border border-zinc-700/60"
        style={{ backgroundColor: '#1c1a18' }}
      >
        <h3 className="text-white font-semibold text-sm mb-1">Knowledge Base — Delete by Slug</h3>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Remove all chunks for a specific slug from the vector store. Use this to fully delete
          a file from the knowledge base, or to manually clear before re-ingesting.
          This action cannot be undone.
        </p>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider block mb-1.5">
              Slug
            </label>
            <input
              type="text"
              value={deleteSlug}
              onChange={e => setDeleteSlug(e.target.value)}
              placeholder="e.g. manifestai"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500/60"
            />
          </div>
          <button
            onClick={handleDeleteBySlug}
            disabled={deleteLoading || !deleteSlug.trim()}
            className={btnDanger + ' h-[38px] px-4'}
          >
            {deleteLoading ? 'Deleting…' : 'Delete'}
          </button>
        </div>

        {deleteStatus && (
          <p
            className="text-xs mt-2"
            style={{ color: deleteStatus.startsWith('✓') ? '#4ade80' : '#f87171' }}
          >
            {deleteStatus}
          </p>
        )}
      </div>

    </div>
  )
}
