'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Experience as ExperienceType } from '@/types/portfolio'

interface ExperienceProps {
  items: ExperienceType[]
}

export function Experience({ items }: ExperienceProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div
      className="bento-item rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FF4500' }} />
        <h2 className="font-heading font-semibold text-xs text-zinc-400 tracking-widest uppercase">
          Experience
        </h2>
      </div>

      {/* Experience list — scrollable when more than 4 entries */}
      <ul
        className="space-y-0"
        style={items.length > 4 ? {
          maxHeight: '220px',
          overflowY: 'scroll',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,69,0,0.3) transparent',
        } : undefined}
      >
        {items.map((item, idx) => (
          <li
            key={item.id}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'flex items-center justify-between py-2.5',
              'transition-opacity duration-200',
              hoveredId !== null && hoveredId !== item.id
                ? 'opacity-40'
                : 'opacity-100',
              idx < items.length - 1 && 'border-b'
            )}
            style={idx < items.length - 1 ? { borderColor: 'var(--border-subtle)' } : undefined}
          >
            {/* Left: role + dates */}
            <div>
              <div className="font-heading font-semibold text-sm" style={{ color: '#FF4500' }}>
                {item.url && item.url !== '#' ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline underline-offset-2"
                  >
                    {item.role}
                  </a>
                ) : (
                  item.role
                )}
              </div>
              <div className="text-zinc-500 text-xs font-body mt-0.5">
                {item.startDate} – {item.endDate}
              </div>
            </div>

            {/* Right: company */}
            <div className="text-right">
              <span className="font-body text-xs text-zinc-400">
                {item.company}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
