import { cn } from '@/lib/utils'
import type { SocialLink, Footer as FooterType } from '@/types/portfolio'

interface FooterProps {
  footer: FooterType
  social: SocialLink[]
  available: boolean
}

export function Footer({ footer, social }: FooterProps) {
  return (
    <footer
      className="bento-item rounded-xl relative overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Orange glow left edge */}
      <div className="footer-glow absolute inset-0 pointer-events-none" />

      <div className="relative px-5 py-4">
        {/* Single row: year (left) + social links (right) — always one line on all screens */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading font-medium text-sm text-zinc-400 whitespace-nowrap">
            Portfolio {new Date().getFullYear()}
          </span>
          <nav className="flex items-center gap-0">
            {social.map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'px-2 py-1 rounded-full text-xs font-heading font-medium',
                  'transition-colors duration-150'
                )}
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#FF4500' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
