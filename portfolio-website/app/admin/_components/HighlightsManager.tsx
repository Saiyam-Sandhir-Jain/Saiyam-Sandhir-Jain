'use client'

import { useState, useRef } from 'react'
import { broadcastPortfolioRefresh } from '@/lib/broadcastRefresh'
import {
  updateHighlightText,
  uploadHighlightImage,
  deleteHighlightImage,
  uploadPhoneImage,
  deletePhoneImage,
  type HighlightSlot,
  type ModalLink,
} from '../_actions/highlights'
import {
  selectHighlightPaper,
  selectHighlightPatent,
} from '../_actions/explorations'
import type { PaperRow, PatentRow } from './ExplorationsManager'

interface HighlightData {
  id:                 string
  slot:               HighlightSlot
  heading:            string
  subheading:         string
  image_url:          string | null
  phone_image_url:    string | null
  modal_heading:      string
  modal_subheading:   string
  modal_abstract:     string
  modal_tags:         string[]
  modal_links:        ModalLink[]
  selected_paper_id?: string | null
  selected_patent_id?: string | null
}

interface Props {
  highlights: HighlightData[]
  papers:     PaperRow[]
  patents:    PatentRow[]
}

const inputCls  = 'bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white w-full'
const labelCls  = 'block text-xs text-zinc-400 mb-1'

const SLOT_LABELS: Record<HighlightSlot, string> = {
  project:  '📱 Project Tile (image renders inside iPhone mockup)',
  research: '📄 Research Paper Tile (image on stacked cards)',
  patent:   '🔬 Patent Tile (image on stacked cards)',
}

// ─── Research tile editor with paper-linking ──────────────────────────────────

function ResearchTileEditor({
  data,
  papers,
}: {
  data:   HighlightData
  papers: PaperRow[]
}) {
  const [heading,       setHeading]       = useState(data.heading)
  const [subheading,    setSubheading]     = useState(data.subheading)
  const [modalHeading,  setModalHeading]   = useState(data.modal_heading)
  const [modalSub,      setModalSub]       = useState(data.modal_subheading)
  const [modalAbstract, setModalAbstract]  = useState(data.modal_abstract)
  const [modalTags,     setModalTags]      = useState<string[]>(data.modal_tags)
  const [modalLinks,    setModalLinks]     = useState<ModalLink[]>(data.modal_links)
  const [tagInput,      setTagInput]       = useState('')
  const [imageUrl,      setImageUrl]       = useState(data.image_url ?? '')
  const [status,        setStatus]         = useState('')
  const [loading,       setLoading]        = useState(false)
  const [selectedPaper, setSelectedPaper]  = useState<string>(data.selected_paper_id ?? '')
  const [linkBusy,      setLinkBusy]       = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const linked = papers.find(p => p.id === selectedPaper)

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setStatus('')
    try { await fn(); broadcastPortfolioRefresh() } catch (e: any) { setStatus(`✗ ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleSaveText = () => wrap(async () => {
    await updateHighlightText(data.slot, {
      heading, subheading, modal_heading: modalHeading,
      modal_subheading: modalSub, modal_abstract: modalAbstract,
      modal_tags: modalTags, modal_links: modalLinks,
    })
    setStatus('✓ Saved')
  })

  const handleImageUpload = () => wrap(async () => {
    const file = imageInputRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('image', file)
    const res = await uploadHighlightImage(data.slot, fd)
    setImageUrl(res.url!)
    setStatus('✓ Image uploaded')
  })

  const handleImageDelete = () => wrap(async () => {
    await deleteHighlightImage(data.slot)
    setImageUrl('')
    setStatus('✓ Image deleted')
  })

  const handlePaperSelect = async (id: string) => {
    setLinkBusy(true)
    try {
      await selectHighlightPaper(id || null)
      setSelectedPaper(id)
    } catch (e: any) { setStatus(`✗ ${e.message}`) }
    finally { setLinkBusy(false) }
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !modalTags.includes(t)) setModalTags(prev => [...prev, t])
    setTagInput('')
  }

  const addLink = () => setModalLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setModalLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: keyof ModalLink, val: string) =>
    setModalLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  return (
    <div className="border border-zinc-800 rounded-xl p-5 space-y-5">
      <p className="text-sm font-bold text-orange-400">{SLOT_LABELS[data.slot]}</p>

      {status && (
        <p className={`text-xs ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{status}</p>
      )}

      {/* ── DB Paper Link ── */}
      <fieldset className="space-y-3 border border-zinc-700 rounded-lg p-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider px-1">
          Link to DB Entry (controls modal content)
        </legend>

        <div>
          <label className={labelCls}>Select Research Paper</label>
          <select
            className={inputCls}
            value={selectedPaper}
            onChange={e => handlePaperSelect(e.target.value)}
            disabled={linkBusy}
          >
            <option value="">None — use manual fields below</option>
            {papers.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.year})</option>
            ))}
          </select>
          {linkBusy && <p className="text-xs text-zinc-500 mt-1">Saving link…</p>}
        </div>

        {linked ? (
          <div className="rounded bg-zinc-900 border border-zinc-700 p-3 space-y-1">
            <p className="text-xs text-white font-medium">{linked.title}</p>
            <p className="text-xs text-zinc-500">{linked.venue} · {linked.year}</p>
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${linked.status === 'published' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-amber-900 text-amber-300 border-amber-700'}`}>
              {linked.status === 'published' ? 'Published' : 'Upcoming'}
            </span>
            <p className="text-xs text-amber-400 mt-2">
              ⚠ Modal will use this paper&apos;s data. Manual fields below are ignored for the modal.
            </p>
          </div>
        ) : null}
      </fieldset>

      {/* ── Card fields ── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Card (visible on home page)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Heading</label>
            <input className={inputCls} value={heading} onChange={e => setHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Subheading</label>
            <input className={inputCls} value={subheading} onChange={e => setSubheading(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Card Image (shown on stacked cards)</label>
          {imageUrl && (
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Tile" className="w-16 h-16 object-cover rounded border border-zinc-700" />
              <button onClick={handleImageDelete} disabled={loading}
                className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30">
                Delete
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="text-xs text-zinc-400" />
            <button onClick={handleImageUpload} disabled={loading}
              className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">
              Upload
            </button>
          </div>
        </div>
      </fieldset>

      <hr className="border-zinc-800" />

      {/* ── Modal fields — dimmed when paper linked ── */}
      <fieldset className={`space-y-3 ${linked ? 'opacity-40 pointer-events-none' : ''}`}>
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Modal content (shown when tile is clicked)
          {linked && <span className="ml-2 text-amber-400 normal-case font-normal">— overridden by linked paper</span>}
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Modal Heading</label>
            <input className={inputCls} value={modalHeading} onChange={e => setModalHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Modal Subheading</label>
            <input className={inputCls} value={modalSub} onChange={e => setModalSub(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Abstract / Description</label>
          <textarea className={inputCls} rows={4} value={modalAbstract} onChange={e => setModalAbstract(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Keywords / Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
            {modalTags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                {t}
                <button onClick={() => setModalTags(prev => prev.filter(x => x !== t))} className="text-zinc-500 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add keyword…" />
            <button onClick={addTag} className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">Add</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>External Links</label>
          <div className="space-y-2 mb-2">
            {modalLinks.map((link, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2">
                <input className={inputCls} value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Label" />
                <input className={inputCls} value={link.url}   onChange={e => updateLink(i, 'url',   e.target.value)} placeholder="URL" />
                <button onClick={() => removeLink(i)} className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 shrink-0">×</button>
              </div>
            ))}
          </div>
          <button onClick={addLink} className="text-xs text-zinc-400 hover:text-white border border-dashed border-zinc-700 rounded px-3 py-1 hover:border-zinc-500 transition-colors">
            + Add Link
          </button>
        </div>
      </fieldset>

      <button onClick={handleSaveText} disabled={loading}
        className="px-4 py-2 text-sm rounded font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50">
        {loading ? 'Saving…' : 'Save Tile'}
      </button>
    </div>
  )
}

// ─── Patent tile editor with patent-linking ───────────────────────────────────

function PatentTileEditor({
  data,
  patents,
}: {
  data:    HighlightData
  patents: PatentRow[]
}) {
  const [heading,       setHeading]       = useState(data.heading)
  const [subheading,    setSubheading]     = useState(data.subheading)
  const [modalHeading,  setModalHeading]   = useState(data.modal_heading)
  const [modalSub,      setModalSub]       = useState(data.modal_subheading)
  const [modalAbstract, setModalAbstract]  = useState(data.modal_abstract)
  const [modalTags,     setModalTags]      = useState<string[]>(data.modal_tags)
  const [modalLinks,    setModalLinks]     = useState<ModalLink[]>(data.modal_links)
  const [tagInput,      setTagInput]       = useState('')
  const [imageUrl,      setImageUrl]       = useState(data.image_url ?? '')
  const [status,        setStatus]         = useState('')
  const [loading,       setLoading]        = useState(false)
  const [selectedPatent, setSelectedPatent] = useState<string>(data.selected_patent_id ?? '')
  const [linkBusy,      setLinkBusy]       = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const linked = patents.find(p => p.id === selectedPatent)

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setStatus('')
    try { await fn(); broadcastPortfolioRefresh() } catch (e: any) { setStatus(`✗ ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleSaveText = () => wrap(async () => {
    await updateHighlightText(data.slot, {
      heading, subheading, modal_heading: modalHeading,
      modal_subheading: modalSub, modal_abstract: modalAbstract,
      modal_tags: modalTags, modal_links: modalLinks,
    })
    setStatus('✓ Saved')
  })

  const handleImageUpload = () => wrap(async () => {
    const file = imageInputRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('image', file)
    const res = await uploadHighlightImage(data.slot, fd)
    setImageUrl(res.url!)
    setStatus('✓ Image uploaded')
  })

  const handleImageDelete = () => wrap(async () => {
    await deleteHighlightImage(data.slot)
    setImageUrl('')
    setStatus('✓ Image deleted')
  })

  const handlePatentSelect = async (id: string) => {
    setLinkBusy(true)
    try {
      await selectHighlightPatent(id || null)
      setSelectedPatent(id)
    } catch (e: any) { setStatus(`✗ ${e.message}`) }
    finally { setLinkBusy(false) }
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !modalTags.includes(t)) setModalTags(prev => [...prev, t])
    setTagInput('')
  }

  const addLink = () => setModalLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setModalLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: keyof ModalLink, val: string) =>
    setModalLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  return (
    <div className="border border-zinc-800 rounded-xl p-5 space-y-5">
      <p className="text-sm font-bold text-orange-400">{SLOT_LABELS[data.slot]}</p>

      {status && (
        <p className={`text-xs ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{status}</p>
      )}

      {/* ── DB Patent Link ── */}
      <fieldset className="space-y-3 border border-zinc-700 rounded-lg p-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider px-1">
          Link to DB Entry (controls modal content)
        </legend>

        <div>
          <label className={labelCls}>Select Patent</label>
          <select
            className={inputCls}
            value={selectedPatent}
            onChange={e => handlePatentSelect(e.target.value)}
            disabled={linkBusy}
          >
            <option value="">None — use manual fields below</option>
            {patents.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.year})</option>
            ))}
          </select>
          {linkBusy && <p className="text-xs text-zinc-500 mt-1">Saving link…</p>}
        </div>

        {linked ? (
          <div className="rounded bg-zinc-900 border border-zinc-700 p-3 space-y-1">
            <p className="text-xs text-white font-medium">{linked.title}</p>
            <p className="text-xs text-zinc-500">{linked.registration_number || '—'} · {linked.year}</p>
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${
              linked.status === 'granted' ? 'bg-green-900 text-green-300 border-green-700'
              : linked.status === 'filed' ? 'bg-amber-900 text-amber-300 border-amber-700'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {linked.status.charAt(0).toUpperCase() + linked.status.slice(1)}
            </span>
            <p className="text-xs text-amber-400 mt-2">
              ⚠ Modal will use this patent&apos;s data. Manual fields below are ignored for the modal.
            </p>
          </div>
        ) : null}
      </fieldset>

      {/* ── Card fields ── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Card (visible on home page)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Heading</label>
            <input className={inputCls} value={heading} onChange={e => setHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Subheading</label>
            <input className={inputCls} value={subheading} onChange={e => setSubheading(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Card Image (shown on stacked cards)</label>
          {imageUrl && (
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Tile" className="w-16 h-16 object-cover rounded border border-zinc-700" />
              <button onClick={handleImageDelete} disabled={loading}
                className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30">
                Delete
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="text-xs text-zinc-400" />
            <button onClick={handleImageUpload} disabled={loading}
              className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">
              Upload
            </button>
          </div>
        </div>
      </fieldset>

      <hr className="border-zinc-800" />

      {/* ── Modal fields — dimmed when patent linked ── */}
      <fieldset className={`space-y-3 ${linked ? 'opacity-40 pointer-events-none' : ''}`}>
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Modal content (shown when tile is clicked)
          {linked && <span className="ml-2 text-amber-400 normal-case font-normal">— overridden by linked patent</span>}
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Modal Heading</label>
            <input className={inputCls} value={modalHeading} onChange={e => setModalHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Modal Subheading</label>
            <input className={inputCls} value={modalSub} onChange={e => setModalSub(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Abstract / Description</label>
          <textarea className={inputCls} rows={4} value={modalAbstract} onChange={e => setModalAbstract(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Keywords / Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
            {modalTags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                {t}
                <button onClick={() => setModalTags(prev => prev.filter(x => x !== t))} className="text-zinc-500 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add keyword…" />
            <button onClick={addTag} className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">Add</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>External Links</label>
          <div className="space-y-2 mb-2">
            {modalLinks.map((link, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2">
                <input className={inputCls} value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Label" />
                <input className={inputCls} value={link.url}   onChange={e => updateLink(i, 'url',   e.target.value)} placeholder="URL" />
                <button onClick={() => removeLink(i)} className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 shrink-0">×</button>
              </div>
            ))}
          </div>
          <button onClick={addLink} className="text-xs text-zinc-400 hover:text-white border border-dashed border-zinc-700 rounded px-3 py-1 hover:border-zinc-500 transition-colors">
            + Add Link
          </button>
        </div>
      </fieldset>

      <button onClick={handleSaveText} disabled={loading}
        className="px-4 py-2 text-sm rounded font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50">
        {loading ? 'Saving…' : 'Save Tile'}
      </button>
    </div>
  )
}

// ─── Generic tile editor (Project tile — no linking) ─────────────────────────

function ProjectTileEditor({ data }: { data: HighlightData }) {
  const [heading,       setHeading]       = useState(data.heading)
  const [subheading,    setSubheading]     = useState(data.subheading)
  const [modalHeading,  setModalHeading]   = useState(data.modal_heading)
  const [modalSub,      setModalSub]       = useState(data.modal_subheading)
  const [modalAbstract, setModalAbstract]  = useState(data.modal_abstract)
  const [modalTags,     setModalTags]      = useState<string[]>(data.modal_tags)
  const [modalLinks,    setModalLinks]     = useState<ModalLink[]>(data.modal_links)
  const [tagInput,      setTagInput]       = useState('')
  const [imageUrl,      setImageUrl]       = useState(data.image_url ?? '')
  const [phoneImageUrl, setPhoneImageUrl]  = useState(data.phone_image_url ?? '')
  const [status,        setStatus]         = useState('')
  const [loading,       setLoading]        = useState(false)
  const imageInputRef      = useRef<HTMLInputElement>(null)
  const phoneImageInputRef = useRef<HTMLInputElement>(null)

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setStatus('')
    try { await fn(); broadcastPortfolioRefresh() } catch (e: any) { setStatus(`✗ ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleSaveText = () => wrap(async () => {
    await updateHighlightText(data.slot, {
      heading, subheading, modal_heading: modalHeading,
      modal_subheading: modalSub, modal_abstract: modalAbstract,
      modal_tags: modalTags, modal_links: modalLinks,
    })
    setStatus('✓ Saved')
  })

  const handleImageUpload = () => wrap(async () => {
    const file = imageInputRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('image', file)
    const res = await uploadHighlightImage(data.slot, fd)
    setImageUrl(res.url!)
    setStatus('✓ Screenshot uploaded')
  })

  const handleImageDelete = () => wrap(async () => {
    await deleteHighlightImage(data.slot)
    setImageUrl('')
    setStatus('✓ Screenshot deleted')
  })

  const handlePhoneImageUpload = () => wrap(async () => {
    const file = phoneImageInputRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('phone_image', file)
    const res = await uploadPhoneImage(fd)
    setPhoneImageUrl(res.url!)
    setStatus('✓ Phone image uploaded')
  })

  const handlePhoneImageDelete = () => wrap(async () => {
    await deletePhoneImage()
    setPhoneImageUrl('')
    setStatus('✓ Phone image deleted')
  })

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !modalTags.includes(t)) setModalTags(prev => [...prev, t])
    setTagInput('')
  }

  const addLink = () => setModalLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setModalLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: keyof ModalLink, val: string) =>
    setModalLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  return (
    <div className="border border-zinc-800 rounded-xl p-5 space-y-5">
      <p className="text-sm font-bold text-orange-400">{SLOT_LABELS[data.slot]}</p>

      {status && (
        <p className={`text-xs ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{status}</p>
      )}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Card (visible on home page)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Heading</label>
            <input className={inputCls} value={heading} onChange={e => setHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Subheading</label>
            <input className={inputCls} value={subheading} onChange={e => setSubheading(e.target.value)} />
          </div>
        </div>

        {/* ── Phone image (replaces SVG mockup) ── */}
        <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
          <div>
            <label className={labelCls} style={{ marginBottom: 0 }}>
              Phone Image —&nbsp;
              <span className="text-zinc-500 normal-case font-normal">transparent PNG replaces the built-in SVG mockup</span>
            </label>
            <p className="text-[10px] text-zinc-600 mt-0.5 mb-2">
              Upload a PNG/WebP with a transparent background showing the full phone with your app inside.
              The hover scale animation still applies. When set, the SVG frame and screenshot below are ignored.
            </p>
          </div>
          {phoneImageUrl ? (
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phoneImageUrl}
                alt="Phone mockup preview"
                className="rounded border border-zinc-700"
                style={{ height: '80px', width: 'auto', objectFit: 'contain', background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 12px 12px' }}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-green-400">✓ Custom phone image set</span>
                <button onClick={handlePhoneImageDelete} disabled={loading}
                  className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 w-fit">
                  Delete (revert to SVG)
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 mb-2">No phone image — using built-in SVG mockup</p>
          )}
          <div className="flex gap-2">
            <input ref={phoneImageInputRef} type="file" accept="image/png,image/webp" className="text-xs text-zinc-400" />
            <button onClick={handlePhoneImageUpload} disabled={loading}
              className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">
              Upload Phone Image
            </button>
          </div>
        </div>

        {/* ── App screenshot (fallback, used inside SVG mockup only) ── */}
        <div>
          <label className={labelCls}>
            App Screenshot&nbsp;
            <span className="text-zinc-600 normal-case font-normal">(used inside SVG mockup only — ignored when phone image above is set)</span>
          </label>
          {imageUrl && (
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Screenshot" className="w-16 h-16 object-cover rounded border border-zinc-700" />
              <button onClick={handleImageDelete} disabled={loading}
                className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30">
                Delete
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="text-xs text-zinc-400" />
            <button onClick={handleImageUpload} disabled={loading}
              className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">
              Upload Screenshot
            </button>
          </div>
        </div>
      </fieldset>

      <hr className="border-zinc-800" />

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Modal content (shown when tile is clicked)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Modal Heading</label>
            <input className={inputCls} value={modalHeading} onChange={e => setModalHeading(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Modal Subheading</label>
            <input className={inputCls} value={modalSub} onChange={e => setModalSub(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Abstract / Description</label>
          <textarea className={inputCls} rows={4} value={modalAbstract} onChange={e => setModalAbstract(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Keywords / Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
            {modalTags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                {t}
                <button onClick={() => setModalTags(prev => prev.filter(x => x !== t))} className="text-zinc-500 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add keyword…" />
            <button onClick={addTag} className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0">Add</button>
          </div>
        </div>
        <div>
          <label className={labelCls}>External Links (GitHub, paper URL, etc.)</label>
          <div className="space-y-2 mb-2">
            {modalLinks.map((link, i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2">
                <input className={inputCls} value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Label (e.g. GitHub)" />
                <input className={inputCls} value={link.url}   onChange={e => updateLink(i, 'url',   e.target.value)} placeholder="URL" />
                <button onClick={() => removeLink(i)} className="px-2 py-1 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 shrink-0">×</button>
              </div>
            ))}
          </div>
          <button onClick={addLink} className="text-xs text-zinc-400 hover:text-white border border-dashed border-zinc-700 rounded px-3 py-1 hover:border-zinc-500 transition-colors">
            + Add Link
          </button>
        </div>
      </fieldset>

      <button onClick={handleSaveText} disabled={loading}
        className="px-4 py-2 text-sm rounded font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50">
        {loading ? 'Saving…' : 'Save Tile'}
      </button>
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function HighlightsManager({ highlights, papers, patents }: Props) {
  const ordered: HighlightSlot[] = ['project', 'research', 'patent']
  const sorted = ordered
    .map(slot => highlights.find(h => h.slot === slot))
    .filter(Boolean) as HighlightData[]

  return (
    <div className="space-y-6">
      <p className="text-xs text-zinc-500">
        Exactly 3 tiles — Project, Research Paper, Patent. Their positions and types are fixed.
        For Research and Patent tiles, you can link a DB entry to control modal content.
      </p>
      {sorted.map(h => {
        if (h.slot === 'research') return <ResearchTileEditor key={h.id} data={h} papers={papers} />
        if (h.slot === 'patent')   return <PatentTileEditor   key={h.id} data={h} patents={patents} />
        return <ProjectTileEditor key={h.id} data={h} />
      })}
    </div>
  )
}
