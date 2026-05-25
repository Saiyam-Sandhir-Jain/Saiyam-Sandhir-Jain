'use client'

import { useEffect, useRef } from 'react'

interface BentoAnimatorProps {
  children: React.ReactNode
  className?: string
  /** delay offset in ms for staggering between multiple animators */
  delayBase?: number
}

/**
 * Wraps bento items and triggers a staggered pop-in animation on viewport entry.
 * Fixed: animejs is transpiled via next.config.js (transpilePackages), so the
 * dynamic import now reliably resolves without ChunkLoadError.
 */
export function BentoAnimator({ children, className, delayBase = 0 }: BentoAnimatorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const targets = Array.from(el.querySelectorAll<HTMLElement>('.bento-item'))
    const els = targets.length > 0 ? targets : [el]

    // Set initial invisible state before the Observer fires
    els.forEach(t => {
      t.style.opacity = '0'
      t.style.transform = 'scale(0.88) translateY(12px)'
      t.style.willChange = 'transform, opacity'
    })

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          observer.disconnect()

          try {
            // animejs is transpiled by Next.js (transpilePackages in next.config.js)
            const animeModule = await import('animejs')
            const anime = animeModule.default ?? animeModule

            anime({
              targets: els,
              scale:    [0.88, 1],
              opacity:  [0, 1],
              translateY: [12, 0],
              delay:    (anime as any).stagger(80, { start: delayBase }),
              easing:   'easeOutElastic(1, .75)',
              duration: 950,
              complete: () => {
                els.forEach(t => { t.style.willChange = 'auto' })
              },
            })
          } catch (err) {
            // Fallback: CSS transition if animejs fails to load
            els.forEach((t, i) => {
              t.style.transition = `opacity 0.5s ease ${i * 80 + delayBase}ms, transform 0.5s ease ${i * 80 + delayBase}ms`
              t.style.opacity = '1'
              t.style.transform = 'scale(1) translateY(0)'
            })
          }
        }
      },
      { threshold: 0.06 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delayBase])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
