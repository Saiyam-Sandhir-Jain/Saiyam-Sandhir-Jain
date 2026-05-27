'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Skill } from '@/types/portfolio'

interface SkillsProps {
  skills: Skill[]
}

// corner: which corner the glow originates from
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const CORNER_POS: Record<Corner, string> = {
  'top-left':     '0% 0%',
  'top-right':    '100% 0%',
  'bottom-left':  '0% 100%',
  'bottom-right': '100% 100%',
}

function SkillCard({
  skill,
  className,
  isFull,
  corner = 'bottom-left',
}: {
  skill: Skill
  className?: string
  isFull?: boolean
  corner?: Corner
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    ref.current?.style.setProperty('--mouse-x', `${x}%`)
    ref.current?.style.setProperty('--mouse-y', `${y}%`)
  }

  const handleMouseLeave = () => {
    ref.current?.style.setProperty('--mouse-x', CORNER_POS[corner].split(' ')[0])
    ref.current?.style.setProperty('--mouse-y', CORNER_POS[corner].split(' ')[1])
  }

  const pos = CORNER_POS[corner]

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'rounded-xl p-4 transition-all duration-300 cursor-default relative overflow-hidden',
        className
      )}
      style={{
        border: '1px solid var(--border)',
        background: isFull
          ? 'linear-gradient(to right, var(--bg-card) 45%, var(--bg-card) 100%)'
          : 'var(--bg-card)',
      }}
    >
      {/* Corner warm glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isFull
            ? `radial-gradient(ellipse 65% 75% at ${pos}, rgba(255,69,0,0.30) 0%, rgba(200,50,0,0.12) 40%, transparent 65%)`
            : `radial-gradient(ellipse 80% 80% at ${pos}, rgba(255,69,0,0.22) 0%, rgba(180,40,0,0.08) 42%, transparent 65%)`,
          borderRadius: 'inherit',
        }}
      />

      <h3 className="font-heading font-semibold text-sm text-zinc-100 mb-2.5 relative tracking-tight">
        {skill.category}
      </h3>

      <div className="flex flex-wrap gap-1.5 relative">
        {skill.tags.map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-md text-zinc-400 text-xs font-body"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// Corner assignments for half-width cards (alternating outer corners)
const HALF_CORNERS: Corner[] = ['top-right', 'bottom-left']

export function Skills({ skills }: SkillsProps) {
  const fullSkills = skills.filter(s => s.size === 'full')
  const halfSkills = skills.filter(s => s.size === 'half')

  return (
    <div className="bento-item space-y-2.5">
      {fullSkills.map(skill => (
        // Full-width card: glow from bottom-left corner
        <SkillCard key={skill.id} skill={skill} isFull corner="bottom-left" />
      ))}

      {halfSkills.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {halfSkills.map((skill, i) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              corner={HALF_CORNERS[i % HALF_CORNERS.length]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
