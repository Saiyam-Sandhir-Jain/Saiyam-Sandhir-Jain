'use client'

import { broadcastPortfolioRefresh } from '@/lib/broadcastRefresh'

import { useState } from 'react'
import {
  addExperience,
  updateExperience,
  deleteExperience,
} from '../_actions/experience'

interface ExpItem {
  id:         string
  role:       string
  company:    string
  start_date: string
  end_date:   string
  is_current: boolean
  url:        string
  sort_order: number
}

const EMPTY: Omit<ExpItem, 'id' | 'sort_order'> = {
  role: '', company: '', start_date: '', end_date: 'Present', is_current: true, url: '',
}

const inputCls  = 'bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white w-full'
const labelCls  = 'block text-xs text-zinc-400 mb-1'
const btnSm     = 'px-2.5 py-1 text-xs rounded font-semibold disabled:opacity-50'

export function ExperienceManager({ initial }: { initial: ExpItem[] }) {
  const [items,   setItems]   = useState<ExpItem[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)   // id being edited
  const [adding,  setAdding]  = useState(false)
  const [form,    setForm]    = useState({ ...EMPTY })
  const [status,  setStatus]  = useState('')
  const [loading, setLoading] = useState(false)

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true)
    setStatus('')
    try {
      await fn()
    } catch (e: any) {
      setStatus(`✗ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => wrap(async () => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)))
    await addExperience(fd)
    // Optimistically append a placeholder and refresh from parent (revalidatePath triggers)
    setAdding(false)
    setForm({ ...EMPTY })
    setStatus('✓ Experience added.'); broadcastPortfolioRefresh()
    // Reload page data via soft refresh
    window.location.reload()
  })

  const handleUpdate = (id: string) => wrap(async () => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)))
    await updateExperience(id, fd)
    setEditing(null)
    setStatus('✓ Experience updated.'); broadcastPortfolioRefresh()
    window.location.reload()
  })

  const handleDelete = (id: string) => wrap(async () => {
    if (!confirm('Delete this experience?')) return
    await deleteExperience(id)
    setItems(prev => prev.filter(i => i.id !== id))
    setStatus('✓ Deleted.'); broadcastPortfolioRefresh()
  })

  const startEdit = (item: ExpItem) => {
    setEditing(item.id)
    setAdding(false)
    setForm({
      role:       item.role,
      company:    item.company,
      start_date: item.start_date,
      end_date:   item.end_date,
      is_current: item.is_current,
      url:        item.url,
    })
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      {status && (
        <p className={`text-sm ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
          {status}
        </p>
      )}

      {/* ── Experience list ── */}
      <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800">
        {items.map(item => (
          <div key={item.id} className="p-3">
            {editing === item.id ? (
              /* ── Inline edit form ── */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Role</label>
                    <input className={inputCls} value={form.role} onChange={f('role')} /></div>
                  <div><label className={labelCls}>Company</label>
                    <input className={inputCls} value={form.company} onChange={f('company')} /></div>
                  <div><label className={labelCls}>Start (e.g. Jan 2024)</label>
                    <input className={inputCls} value={form.start_date} onChange={f('start_date')} /></div>
                  <div><label className={labelCls}>End (or "Present")</label>
                    <input className={inputCls} value={form.end_date} onChange={f('end_date')} /></div>
                </div>
                <div><label className={labelCls}>URL (optional)</label>
                  <input className={inputCls} value={form.url} onChange={f('url')} placeholder="#" /></div>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleUpdate(item.id)} disabled={loading}
                    className={`${btnSm} bg-green-700 hover:bg-green-600 text-white`}>
                    Save
                  </button>
                  <button onClick={() => setEditing(null)} disabled={loading}
                    className={`${btnSm} bg-zinc-700 hover:bg-zinc-600 text-white`}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── Read view ── */
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-orange-400">{item.role}</p>
                  <p className="text-xs text-zinc-400">{item.start_date} – {item.end_date} · {item.company}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(item)} disabled={loading}
                    className={`${btnSm} bg-zinc-700 hover:bg-zinc-600 text-white`}>Edit</button>
                  <button onClick={() => handleDelete(item.id)} disabled={loading}
                    className={`${btnSm} bg-red-900 hover:bg-red-800 text-white`}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">No experience entries yet.</p>
        )}
      </div>

      {/* ── Add new form ── */}
      {adding ? (
        <div className="border border-zinc-700 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-300">New Experience</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Role</label>
              <input className={inputCls} value={form.role} onChange={f('role')} placeholder="SDE Intern" /></div>
            <div><label className={labelCls}>Company</label>
              <input className={inputCls} value={form.company} onChange={f('company')} placeholder="Acme Corp" /></div>
            <div><label className={labelCls}>Start (e.g. Jan 2024)</label>
              <input className={inputCls} value={form.start_date} onChange={f('start_date')} placeholder="Jan 2024" /></div>
            <div><label className={labelCls}>End (or "Present")</label>
              <input className={inputCls} value={form.end_date} onChange={f('end_date')} placeholder="Present" /></div>
          </div>
          <div><label className={labelCls}>URL (optional)</label>
            <input className={inputCls} value={form.url} onChange={f('url')} placeholder="#" /></div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading}
              className={`${btnSm} bg-orange-600 hover:bg-orange-500 text-white`}>
              {loading ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => { setAdding(false); setForm({ ...EMPTY }) }} disabled={loading}
              className={`${btnSm} bg-zinc-700 hover:bg-zinc-600 text-white`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setEditing(null); setForm({ ...EMPTY }) }}
          className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          + Add Experience
        </button>
      )}
    </div>
  )
}
