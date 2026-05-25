'use client'

import { broadcastPortfolioRefresh } from '@/lib/broadcastRefresh'

import { useState } from 'react'
import { updateSkill } from '../_actions/skills'

interface SkillData {
  id:       string
  slot:     1 | 2 | 3
  category: string
  size:     'full' | 'half'
  tags:     string[]
}

const inputCls = 'bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white w-full'
const labelCls = 'block text-xs text-zinc-400 mb-1'

function SkillTileEditor({
  skill,
  label,
}: {
  skill: SkillData
  label: string
}) {
  const [category, setCategory] = useState(skill.category)
  const [tags,     setTags]     = useState<string[]>(skill.tags)
  const [tagInput, setTagInput] = useState('')
  const [status,   setStatus]   = useState('')
  const [loading,  setLoading]  = useState(false)

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const handleSave = async () => {
    setLoading(true)
    setStatus('')
    try {
      await updateSkill(skill.slot, category, tags)
      setStatus('✓ Saved'); broadcastPortfolioRefresh()
    } catch (e: any) {
      setStatus(`✗ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-300">{label}</p>
        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">
          {skill.size === 'full' ? 'Full width' : 'Half width'}
        </span>
      </div>

      <div>
        <label className={labelCls}>Tile Title</label>
        <input
          className={inputCls}
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Generative AI & NLP"
        />
      </div>

      <div>
        <label className={labelCls}>Skill Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-8">
          {tags.map(t => (
            <span
              key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
            >
              {t}
              <button
                onClick={() => removeTag(t)}
                className="text-zinc-500 hover:text-red-400 ml-0.5 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Type a tag and press Enter"
          />
          <button
            onClick={addTag}
            className="px-3 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-white shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Tile'}
        </button>
        {status && (
          <span className={`text-xs ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  )
}

export function SkillsManager({ skills }: { skills: SkillData[] }) {
  const sorted = [...skills].sort((a, b) => a.slot - b.slot)
  const labels = ['Tile 1 (Full-width)', 'Tile 2 (Half-width, left)', 'Tile 3 (Half-width, right)']

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Exactly 3 tiles. Tile 1 is full-width; tiles 2 & 3 share a row.
        The size (full/half) cannot be changed — it matches the visual layout.
      </p>
      {sorted.map((skill, i) => (
        <SkillTileEditor key={skill.id} skill={skill} label={labels[i]} />
      ))}
    </div>
  )
}
