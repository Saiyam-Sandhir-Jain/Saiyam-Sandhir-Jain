'use client'

import { useState, useRef, useTransition } from 'react'
import { broadcastPortfolioRefresh } from '@/lib/broadcastRefresh'
import {
  addPaper, updatePaper, deletePaper, swapPaperOrder,
  addPatent, updatePatent, deletePatent, swapPatentOrder,
  addCertificate, updateCertificate, deleteCertificate, uploadCertificateImage, deleteCertificateImage, swapCertificateOrder,
  addLOR, updateLOR, deleteLOR, uploadLORPdf, deleteLORPdf, swapLOROrder,
} from '../_actions/explorations'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperRow {
  id:          string
  title:       string
  status:      'published' | 'upcoming'
  venue:       string
  year:        number
  authors:     string[]
  abstract:    string
  tags:        string[]
  scholar_url: string | null
  sort_order:  number
}

export interface PatentRow {
  id:                  string
  title:               string
  status:              'filed' | 'granted' | 'upcoming'
  registration_number: string
  year:                number
  abstract:            string
  tags:                string[]
  sort_order:          number
}

interface CertRow {
  id:        string
  title:     string
  issuer:    string
  platform:  string
  year:      string
  image_url: string | null
  sort_order: number
}

interface LORRow {
  id:               string
  recommender_name: string
  organization:     string
  designation:      string
  relationship:     string
  available:        boolean
  pdf_url:          string | null
  sort_order:       number
}

interface Props {
  papers:       PaperRow[]
  patents:      PatentRow[]
  certificates: CertRow[]
  lors:         LORRow[]
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls  = 'bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white w-full'
const labelCls  = 'block text-xs text-zinc-400 mb-1'
const btnSm     = 'px-2 py-1 text-xs rounded border'
const btnOrange = 'px-4 py-2 text-sm rounded font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50'
const btnGhost  = 'px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0'

// ─── TagInput ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
        {tags.map(t => (
          <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="text-zinc-500 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Type and press Enter…" />
        <button type="button" onClick={add} className={btnGhost}>Add</button>
      </div>
    </div>
  )
}

// ─── Status msg ──────────────────────────────────────────────────────────────

function Msg({ s }: { s: string }) {
  if (!s) return null
  return <p className={`text-xs ${s.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{s}</p>
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAPERS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_PAPER = (): Omit<PaperRow, 'id' | 'sort_order'> => ({
  title: '', status: 'upcoming', venue: '', year: new Date().getFullYear(),
  authors: [], abstract: '', tags: [], scholar_url: null,
})

function PaperForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  initial: Omit<PaperRow, 'id' | 'sort_order'>
  onSave: (fd: FormData) => Promise<void>
  onCancel?: () => void
  saveLabel?: string
}) {
  const [d, setD]   = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.set('title',       d.title)
      fd.set('status',      d.status)
      fd.set('venue',       d.venue)
      fd.set('year',        String(d.year))
      fd.set('authors',     JSON.stringify(d.authors))
      fd.set('abstract',    d.abstract)
      fd.set('tags',        JSON.stringify(d.tags))
      fd.set('scholar_url', d.scholar_url ?? '')
      await onSave(fd)
      setMsg('✓ Saved'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 pt-2">
      <Msg s={msg} />
      <div>
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={d.title} onChange={e => setD(p => ({ ...p, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={d.status} onChange={e => setD(p => ({ ...p, status: e.target.value as any }))}>
            <option value="published">Published</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <input type="number" className={inputCls} value={d.year} onChange={e => setD(p => ({ ...p, year: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Conference / Journal name</label>
        <input className={inputCls} value={d.venue} onChange={e => setD(p => ({ ...p, venue: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Authors</label>
        <TagInput tags={d.authors} onChange={v => setD(p => ({ ...p, authors: v }))} />
      </div>
      <div>
        <label className={labelCls}>Abstract</label>
        <textarea className={inputCls} rows={5} value={d.abstract} onChange={e => setD(p => ({ ...p, abstract: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Keywords &amp; Stack</label>
        <TagInput tags={d.tags} onChange={v => setD(p => ({ ...p, tags: v }))} />
      </div>
      <div>
        <label className={labelCls}>Scholar / DOI link (leave blank if upcoming)</label>
        <input className={inputCls} value={d.scholar_url ?? ''} onChange={e => setD(p => ({ ...p, scholar_url: e.target.value || null }))} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handle} disabled={busy} className={btnOrange}>{busy ? 'Saving…' : saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className={`${btnGhost} bg-zinc-800`}>Cancel</button>}
      </div>
    </div>
  )
}

function PapersSection({ initial }: { initial: PaperRow[] }) {
  const [papers, setPapers] = useState<PaperRow[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [msg, setMsg] = useState('')
  const [, start] = useTransition()

  const statusBadge = (s: PaperRow['status']) =>
    s === 'published'
      ? <span className="px-1.5 py-0.5 rounded text-xs bg-green-900 text-green-300 border border-green-700">Published</span>
      : <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900 text-amber-300 border border-amber-700">Upcoming</span>

  const handleAdd = async (fd: FormData) => {
    await addPaper(fd)
    // Refresh: re-fetch is done by revalidatePath; for local state we just reload page
    window.location.reload()
  }

  const handleUpdate = (id: string) => async (fd: FormData) => {
    await updatePaper(id, fd)
    setEditing(null)
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this paper?')) return
    try {
      await deletePaper(id)
      setPapers(p => p.filter(x => x.id !== id))
      setMsg('✓ Deleted'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
  }

  return (
    <div className="space-y-4">
      <Msg s={msg} />
      {papers.map(p => (
        <div key={p.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
          {editing === p.id ? (
            <>
              <p className="text-xs font-semibold text-orange-400 mb-2">Editing paper</p>
              <PaperForm
                initial={{ title: p.title, status: p.status, venue: p.venue, year: p.year, authors: p.authors, abstract: p.abstract, tags: p.tags, scholar_url: p.scholar_url }}
                onSave={handleUpdate(p.id)}
                onCancel={() => setEditing(null)}
                saveLabel="Update Paper"
              />
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={async () => {
                    const idx = papers.findIndex(x => x.id === p.id)
                    if (idx <= 0) return
                    const prev = papers[idx - 1]
                    await swapPaperOrder(p.id, p.sort_order, prev.id, prev.sort_order)
                    const next = [...papers]
                    next[idx - 1] = { ...p, sort_order: prev.sort_order }
                    next[idx]     = { ...prev, sort_order: p.sort_order }
                    setPapers(next)
                  }}
                  disabled={papers.indexOf(p) === 0}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move up"
                >↑</button>
                <button
                  onClick={async () => {
                    const idx = papers.findIndex(x => x.id === p.id)
                    if (idx >= papers.length - 1) return
                    const next_ = papers[idx + 1]
                    await swapPaperOrder(p.id, p.sort_order, next_.id, next_.sort_order)
                    const arr = [...papers]
                    arr[idx]     = { ...next_, sort_order: p.sort_order }
                    arr[idx + 1] = { ...p, sort_order: next_.sort_order }
                    setPapers(arr)
                  }}
                  disabled={papers.indexOf(p) === papers.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move down"
                >↓</button>
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{p.title || '(untitled)'}</p>
                <p className="text-xs text-zinc-500">{p.venue} · {p.year}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {statusBadge(p.status)}
                <button onClick={() => setEditing(p.id)} className={`${btnSm} border-zinc-600 text-zinc-300 hover:bg-zinc-700`}>Edit</button>
                <button onClick={() => handleDelete(p.id)} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-zinc-700 rounded-lg p-4">
          <p className="text-xs font-semibold text-orange-400 mb-2">New Research Paper</p>
          <PaperForm initial={EMPTY_PAPER()} onSave={handleAdd} onCancel={() => setAdding(false)} saveLabel="Add Paper" />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-2 text-sm border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
          + Add Research Paper
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATENTS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_PATENT = (): Omit<PatentRow, 'id' | 'sort_order'> => ({
  title: '', status: 'upcoming', registration_number: '',
  year: new Date().getFullYear(), abstract: '', tags: [],
})

function PatentForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  initial: Omit<PatentRow, 'id' | 'sort_order'>
  onSave: (fd: FormData) => Promise<void>
  onCancel?: () => void
  saveLabel?: string
}) {
  const [d, setD]   = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.set('title',               d.title)
      fd.set('status',              d.status)
      fd.set('registration_number', d.registration_number)
      fd.set('year',                String(d.year))
      fd.set('abstract',            d.abstract)
      fd.set('tags',                JSON.stringify(d.tags))
      await onSave(fd)
      setMsg('✓ Saved'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 pt-2">
      <Msg s={msg} />
      <div>
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={d.title} onChange={e => setD(p => ({ ...p, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={d.status} onChange={e => setD(p => ({ ...p, status: e.target.value as any }))}>
            <option value="upcoming">Upcoming</option>
            <option value="filed">Filed</option>
            <option value="granted">Granted</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <input type="number" className={inputCls} value={d.year} onChange={e => setD(p => ({ ...p, year: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className={labelCls}>Registration Number</label>
          <input className={inputCls} value={d.registration_number} onChange={e => setD(p => ({ ...p, registration_number: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Abstract</label>
        <textarea className={inputCls} rows={5} value={d.abstract} onChange={e => setD(p => ({ ...p, abstract: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Tags</label>
        <TagInput tags={d.tags} onChange={v => setD(p => ({ ...p, tags: v }))} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handle} disabled={busy} className={btnOrange}>{busy ? 'Saving…' : saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className={`${btnGhost} bg-zinc-800`}>Cancel</button>}
      </div>
    </div>
  )
}

function PatentsSection({ initial }: { initial: PatentRow[] }) {
  const [patents, setPatents] = useState<PatentRow[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [msg, setMsg] = useState('')

  const statusBadge = (s: PatentRow['status']) => {
    if (s === 'granted')  return <span className="px-1.5 py-0.5 rounded text-xs bg-green-900 text-green-300 border border-green-700">Granted</span>
    if (s === 'filed')    return <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900 text-amber-300 border border-amber-700">Filed</span>
    return <span className="px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">Upcoming</span>
  }

  const handleAdd = async (fd: FormData) => {
    await addPatent(fd)
    window.location.reload()
  }

  const handleUpdate = (id: string) => async (fd: FormData) => {
    await updatePatent(id, fd)
    setEditing(null)
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this patent?')) return
    try {
      await deletePatent(id)
      setPatents(p => p.filter(x => x.id !== id))
      setMsg('✓ Deleted'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
  }

  return (
    <div className="space-y-4">
      <Msg s={msg} />
      {patents.map(p => (
        <div key={p.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
          {editing === p.id ? (
            <>
              <p className="text-xs font-semibold text-orange-400 mb-2">Editing patent</p>
              <PatentForm
                initial={{ title: p.title, status: p.status, registration_number: p.registration_number, year: p.year, abstract: p.abstract, tags: p.tags }}
                onSave={handleUpdate(p.id)}
                onCancel={() => setEditing(null)}
                saveLabel="Update Patent"
              />
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={async () => {
                    const idx = patents.findIndex(x => x.id === p.id)
                    if (idx <= 0) return
                    const prev = patents[idx - 1]
                    await swapPatentOrder(p.id, p.sort_order, prev.id, prev.sort_order)
                    const next = [...patents]
                    next[idx - 1] = { ...p, sort_order: prev.sort_order }
                    next[idx]     = { ...prev, sort_order: p.sort_order }
                    setPatents(next)
                  }}
                  disabled={patents.indexOf(p) === 0}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move up"
                >↑</button>
                <button
                  onClick={async () => {
                    const idx = patents.findIndex(x => x.id === p.id)
                    if (idx >= patents.length - 1) return
                    const next_ = patents[idx + 1]
                    await swapPatentOrder(p.id, p.sort_order, next_.id, next_.sort_order)
                    const arr = [...patents]
                    arr[idx]     = { ...next_, sort_order: p.sort_order }
                    arr[idx + 1] = { ...p, sort_order: next_.sort_order }
                    setPatents(arr)
                  }}
                  disabled={patents.indexOf(p) === patents.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move down"
                >↓</button>
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{p.title || '(untitled)'}</p>
                <p className="text-xs text-zinc-500">{p.registration_number || '—'} · {p.year}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {statusBadge(p.status)}
                <button onClick={() => setEditing(p.id)} className={`${btnSm} border-zinc-600 text-zinc-300 hover:bg-zinc-700`}>Edit</button>
                <button onClick={() => handleDelete(p.id)} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-zinc-700 rounded-lg p-4">
          <p className="text-xs font-semibold text-orange-400 mb-2">New Patent</p>
          <PatentForm initial={EMPTY_PATENT()} onSave={handleAdd} onCancel={() => setAdding(false)} saveLabel="Add Patent" />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-2 text-sm border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
          + Add Patent
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_CERT = (): Omit<CertRow, 'id' | 'sort_order' | 'image_url'> => ({
  title: '', issuer: '', platform: '', year: String(new Date().getFullYear()),
})

function CertForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  initial: Omit<CertRow, 'id' | 'sort_order' | 'image_url'>
  onSave: (fd: FormData) => Promise<void>
  onCancel?: () => void
  saveLabel?: string
}) {
  const [d, setD]   = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.set('title',    d.title)
      fd.set('issuer',   d.issuer)
      fd.set('platform', d.platform)
      fd.set('year',     d.year)
      await onSave(fd)
      setMsg('✓ Saved'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 pt-2">
      <Msg s={msg} />
      <div>
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={d.title} onChange={e => setD(p => ({ ...p, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Company / Publisher</label>
          <input className={inputCls} value={d.issuer} onChange={e => setD(p => ({ ...p, issuer: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Platform or Event (e.g. Coursera, AWS, ICLR)</label>
          <input className={inputCls} value={d.platform} onChange={e => setD(p => ({ ...p, platform: e.target.value }))} />
        </div>
      </div>
      <div className="w-32">
        <label className={labelCls}>Year</label>
        <input className={inputCls} value={d.year} onChange={e => setD(p => ({ ...p, year: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handle} disabled={busy} className={btnOrange}>{busy ? 'Saving…' : saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className={`${btnGhost} bg-zinc-800`}>Cancel</button>}
      </div>
    </div>
  )
}

function CertImageManager({ cert }: { cert: CertRow }) {
  const [imgUrl, setImgUrl] = useState(cert.image_url ?? '')
  const [msg, setMsg]       = useState('')
  const [busy, setBusy]     = useState(false)
  const fileRef             = useRef<HTMLInputElement>(null)

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('')
    try { await fn() } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="border-t border-zinc-800 pt-3 mt-3 space-y-2">
      <p className="text-xs text-zinc-400 font-medium">Certificate Image</p>
      <Msg s={msg} />
      {imgUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="cert" className="w-16 h-16 object-cover rounded border border-zinc-700" />
          <button disabled={busy} onClick={() => wrap(async () => {
            await deleteCertificateImage(cert.id)
            setImgUrl('')
            setMsg('✓ Deleted'); broadcastPortfolioRefresh()
          })} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>
            Delete Image
          </button>
        </div>
      ) : null}
      <div className="flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="image/jpeg,image/jpg" className="text-xs text-zinc-400" />
        <button disabled={busy} onClick={() => wrap(async () => {
          const file = fileRef.current?.files?.[0]
          if (!file) return
          const fd = new FormData()
          fd.append('image', file)
          const res = await uploadCertificateImage(cert.id, fd)
          setImgUrl(res.url!)
          setMsg('✓ Uploaded'); broadcastPortfolioRefresh()
        })} className={btnGhost}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      <p className="text-xs text-zinc-600">Only jpg/jpeg accepted.</p>
    </div>
  )
}

function CertificatesSection({ initial }: { initial: CertRow[] }) {
  const [certs, setCerts] = useState<CertRow[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [msg, setMsg] = useState('')

  const handleAdd = async (fd: FormData) => {
    await addCertificate(fd)
    window.location.reload()
  }

  const handleUpdate = (id: string) => async (fd: FormData) => {
    await updateCertificate(id, fd)
    setEditing(null)
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this certificate?')) return
    try {
      await deleteCertificate(id)
      setCerts(p => p.filter(x => x.id !== id))
      setMsg('✓ Deleted'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
  }

  return (
    <div className="space-y-4">
      <Msg s={msg} />
      {certs.map(c => (
        <div key={c.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
          {editing === c.id ? (
            <>
              <p className="text-xs font-semibold text-orange-400 mb-2">Editing certificate</p>
              <CertForm
                initial={{ title: c.title, issuer: c.issuer, platform: c.platform, year: c.year }}
                onSave={handleUpdate(c.id)}
                onCancel={() => setEditing(null)}
                saveLabel="Update Certificate"
              />
              <CertImageManager cert={c} />
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={async () => {
                    const idx = certs.findIndex(x => x.id === c.id)
                    if (idx <= 0) return
                    const prev = certs[idx - 1]
                    await swapCertificateOrder(c.id, c.sort_order, prev.id, prev.sort_order)
                    const next = [...certs]
                    next[idx - 1] = { ...c, sort_order: prev.sort_order }
                    next[idx]     = { ...prev, sort_order: c.sort_order }
                    setCerts(next)
                  }}
                  disabled={certs.indexOf(c) === 0}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move up"
                >↑</button>
                <button
                  onClick={async () => {
                    const idx = certs.findIndex(x => x.id === c.id)
                    if (idx >= certs.length - 1) return
                    const next_ = certs[idx + 1]
                    await swapCertificateOrder(c.id, c.sort_order, next_.id, next_.sort_order)
                    const arr = [...certs]
                    arr[idx]     = { ...next_, sort_order: c.sort_order }
                    arr[idx + 1] = { ...c, sort_order: next_.sort_order }
                    setCerts(arr)
                  }}
                  disabled={certs.indexOf(c) === certs.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move down"
                >↓</button>
              </div>
              {c.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="w-8 h-8 object-cover rounded border border-zinc-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{c.title || '(untitled)'}</p>
                <p className="text-xs text-zinc-500">{c.issuer} · {c.platform} · {c.year}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(c.id)} className={`${btnSm} border-zinc-600 text-zinc-300 hover:bg-zinc-700`}>Edit</button>
                <button onClick={() => handleDelete(c.id)} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-zinc-700 rounded-lg p-4">
          <p className="text-xs font-semibold text-orange-400 mb-1">New Certificate</p>
          <p className="text-xs text-zinc-500 mb-3">Save the entry first, then upload the image.</p>
          <CertForm initial={EMPTY_CERT()} onSave={handleAdd} onCancel={() => setAdding(false)} saveLabel="Add Certificate" />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-2 text-sm border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
          + Add Certificate
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LORs SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_LOR = (): Omit<LORRow, 'id' | 'sort_order' | 'pdf_url'> => ({
  recommender_name: '', organization: '', designation: '', relationship: '', available: true,
})

function LORForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  initial: Omit<LORRow, 'id' | 'sort_order' | 'pdf_url'>
  onSave: (fd: FormData) => Promise<void>
  onCancel?: () => void
  saveLabel?: string
}) {
  const [d, setD]   = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.set('recommender_name', d.recommender_name)
      fd.set('organization',     d.organization)
      fd.set('designation',      d.designation)
      fd.set('relationship',     d.relationship)
      fd.set('available',        String(d.available))
      await onSave(fd)
      setMsg('✓ Saved'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 pt-2">
      <Msg s={msg} />
      <div>
        <label className={labelCls}>Recommender Full Name</label>
        <input className={inputCls} value={d.recommender_name} onChange={e => setD(p => ({ ...p, recommender_name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Company / Institute</label>
          <input className={inputCls} value={d.organization} onChange={e => setD(p => ({ ...p, organization: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Their job title</label>
          <input className={inputCls} value={d.designation} onChange={e => setD(p => ({ ...p, designation: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Their role towards you (e.g. Research Supervisor, Internship Mentor)</label>
        <input className={inputCls} value={d.relationship} onChange={e => setD(p => ({ ...p, relationship: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handle} disabled={busy} className={btnOrange}>{busy ? 'Saving…' : saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className={`${btnGhost} bg-zinc-800`}>Cancel</button>}
      </div>
    </div>
  )
}

function LORPdfManager({ lor }: { lor: LORRow }) {
  const [pdfUrl, setPdfUrl] = useState(lor.pdf_url ?? '')
  const [msg, setMsg]       = useState('')
  const [busy, setBusy]     = useState(false)
  const fileRef             = useRef<HTMLInputElement>(null)

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('')
    try { await fn() } catch (e: any) { setMsg(`✗ ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="border-t border-zinc-800 pt-3 mt-3 space-y-2">
      <p className="text-xs text-zinc-400 font-medium">LOR PDF</p>
      <Msg s={msg} />
      {pdfUrl ? (
        <div className="flex items-center gap-3">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate max-w-xs">View PDF ↗</a>
          <button disabled={busy} onClick={() => wrap(async () => {
            await deleteLORPdf(lor.id)
            setPdfUrl('')
            setMsg('✓ Deleted'); broadcastPortfolioRefresh()
          })} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>
            Delete
          </button>
        </div>
      ) : null}
      <div className="flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="application/pdf" className="text-xs text-zinc-400" />
        <button disabled={busy} onClick={() => wrap(async () => {
          const file = fileRef.current?.files?.[0]
          if (!file) return
          const fd = new FormData()
          fd.append('pdf', file)
          const res = await uploadLORPdf(lor.id, fd)
          setPdfUrl(res.url!)
          setMsg('✓ Uploaded'); broadcastPortfolioRefresh()
        })} className={btnGhost}>
          {busy ? 'Uploading…' : 'Upload PDF'}
        </button>
      </div>
    </div>
  )
}

function LORsSection({ initial }: { initial: LORRow[] }) {
  const [lors, setLors] = useState<LORRow[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [msg, setMsg] = useState('')

  const handleAdd = async (fd: FormData) => {
    await addLOR(fd)
    window.location.reload()
  }

  const handleUpdate = (id: string) => async (fd: FormData) => {
    await updateLOR(id, fd)
    setEditing(null)
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this LOR?')) return
    try {
      await deleteLOR(id)
      setLors(p => p.filter(x => x.id !== id))
      setMsg('✓ Deleted'); broadcastPortfolioRefresh()
    } catch (e: any) { setMsg(`✗ ${e.message}`) }
  }

  return (
    <div className="space-y-4">
      <Msg s={msg} />
      {lors.map(l => (
        <div key={l.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
          {editing === l.id ? (
            <>
              <p className="text-xs font-semibold text-orange-400 mb-2">Editing LOR</p>
              <LORForm
                initial={{ recommender_name: l.recommender_name, organization: l.organization, designation: l.designation, relationship: l.relationship, available: l.available }}
                onSave={handleUpdate(l.id)}
                onCancel={() => setEditing(null)}
                saveLabel="Update LOR"
              />
              <LORPdfManager lor={l} />
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={async () => {
                    const idx = lors.findIndex(x => x.id === l.id)
                    if (idx <= 0) return
                    const prev = lors[idx - 1]
                    await swapLOROrder(l.id, l.sort_order, prev.id, prev.sort_order)
                    const next = [...lors]
                    next[idx - 1] = { ...l, sort_order: prev.sort_order }
                    next[idx]     = { ...prev, sort_order: l.sort_order }
                    setLors(next)
                  }}
                  disabled={lors.indexOf(l) === 0}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move up"
                >↑</button>
                <button
                  onClick={async () => {
                    const idx = lors.findIndex(x => x.id === l.id)
                    if (idx >= lors.length - 1) return
                    const next_ = lors[idx + 1]
                    await swapLOROrder(l.id, l.sort_order, next_.id, next_.sort_order)
                    const arr = [...lors]
                    arr[idx]     = { ...next_, sort_order: l.sort_order }
                    arr[idx + 1] = { ...l, sort_order: next_.sort_order }
                    setLors(arr)
                  }}
                  disabled={lors.indexOf(l) === lors.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-20"
                  title="Move down"
                >↓</button>
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm text-white font-medium">{l.recommender_name || '(unnamed)'}</p>
                <p className="text-xs text-zinc-500">{l.organization} · {l.designation}</p>
                {l.pdf_url && (
                  <a href={l.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">PDF ↗</a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditing(l.id)} className={`${btnSm} border-zinc-600 text-zinc-300 hover:bg-zinc-700`}>Edit</button>
                <button onClick={() => handleDelete(l.id)} className={`${btnSm} border-red-800 text-red-400 hover:bg-red-900/30`}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-zinc-700 rounded-lg p-4">
          <p className="text-xs font-semibold text-orange-400 mb-1">New LOR</p>
          <p className="text-xs text-zinc-500 mb-3">Save the entry first, then upload the PDF.</p>
          <LORForm initial={EMPTY_LOR()} onSave={handleAdd} onCancel={() => setAdding(false)} saveLabel="Add LOR" />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-2 text-sm border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
          + Add Letter of Recommendation
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

type SubTab = 'papers' | 'patents' | 'certificates' | 'lors'

export function ExplorationsManager({ papers, patents, certificates, lors }: Props) {
  const [tab, setTab] = useState<SubTab>('papers')

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'papers',       label: 'Papers'       },
    { id: 'patents',      label: 'Patents'      },
    { id: 'certificates', label: 'Certificates' },
    { id: 'lors',         label: 'LORs'         },
  ]

  return (
    <div className="space-y-6">
      <p className="text-xs text-zinc-500">
        Manage your research papers, patents, certificates, and letters of recommendation.
        These populate the Explorations section of your portfolio.
      </p>

      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'papers'       && <PapersSection       initial={papers}       />}
      {tab === 'patents'      && <PatentsSection      initial={patents}      />}
      {tab === 'certificates' && <CertificatesSection initial={certificates} />}
      {tab === 'lors'         && <LORsSection         initial={lors}         />}
    </div>
  )
}
