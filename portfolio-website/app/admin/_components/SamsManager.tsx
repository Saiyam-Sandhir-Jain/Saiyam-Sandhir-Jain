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

export function SamsManager({ samsAvatarUrl: initialAvatarUrl }: SamsManagerProps) {
  // ── Avatar state ──────────────────────────────────────────────────────────
  const [avatarUrl,    setAvatarUrl]    = useState(initialAvatarUrl ?? '')
  const [avatarStatus, setAvatarStatus] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Ingestion state ───────────────────────────────────────────────────────
  const [ingestFiles,   setIngestFiles]   = useState<FileList | null>(null)
  const [ingestStatus,  setIngestStatus]  = useState('')
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResults, setIngestResults] = useState<Array<{
    filename: string
    total_chunks?: number
    message?: string
    error?: string
  }>>([])
  const ingestInputRef = useRef<HTMLInputElement>(null)

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
      setIngestStatus('Please select one or more .txt files.')
      return
    }

    // Validate all files are .txt
    for (let i = 0; i < ingestFiles.length; i++) {
      if (!ingestFiles[i].name.toLowerCase().endsWith('.txt')) {
        setIngestStatus(`✗ "${ingestFiles[i].name}" is not a .txt file. Only plain text files are accepted.`)
        return
      }
    }

    setIngestLoading(true)
    setIngestStatus(`Ingesting ${ingestFiles.length} file(s)…`)
    setIngestResults([])

    const results: typeof ingestResults = []

    for (let i = 0; i < ingestFiles.length; i++) {
      const file = ingestFiles[i]
      setIngestStatus(`Ingesting ${i + 1} / ${ingestFiles.length}: ${file.name}…`)

      try {
        const fd = new FormData()
        fd.append('file', file)

        const res  = await fetch('/api/sams/ingest', { method: 'POST', body: fd })
        const json = await res.json()

        if (res.ok) {
          results.push({
            filename:     json.filename ?? file.name,
            total_chunks: json.total_chunks,
            message:      json.message ?? 'Ingestion complete.',
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
  }

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
                // Trigger upload immediately on selection
                if (e.target.files?.[0]) {
                  setTimeout(handleAvatarUpload, 0)
                }
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
                <button
                  onClick={handleAvatarDelete}
                  disabled={avatarLoading}
                  className={btnDanger}
                >
                  Remove
                </button>
              )}
            </div>
            {avatarStatus && (
              <p
                className="text-xs mt-1"
                style={{ color: avatarStatus.startsWith('✓') ? '#4ade80' : '#f87171' }}
              >
                {avatarStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Knowledge Base ── */}
      <div
        className="p-5 rounded-xl border border-zinc-700/60"
        style={{ backgroundColor: '#1c1a18' }}
      >
        <h3 className="text-white font-semibold text-sm mb-1">Knowledge Base — Ingestion</h3>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Upload plain-text <code className="bg-zinc-800 px-1 rounded text-zinc-300">.txt</code> files to add them to Sams' knowledge base. Each file is chunked, embedded via Gemini, and stored in Supabase pgvector.
          You can upload multiple files at once.
        </p>

        <div className="space-y-3">
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
              accept=".txt"
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
                : 'Click or drag .txt files here'}
            </p>
            <p className="text-zinc-600 text-xs mt-1">Plain text only — UTF-8 encoded</p>
          </div>

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
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: r.error ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.06)',
                  border: `1px solid ${r.error ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.15)'}`,
                }}
              >
                <span style={{ color: r.error ? '#f87171' : '#4ade80' }}>{r.error ? '✗' : '✓'}</span>
                <span className="font-mono text-zinc-300 flex-1 truncate">{r.filename}</span>
                {r.total_chunks !== undefined && (
                  <span className="text-zinc-500">{r.total_chunks} chunks</span>
                )}
                {r.error && <span className="text-red-400">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
