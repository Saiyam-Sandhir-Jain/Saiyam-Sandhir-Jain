'use client'

/**
 * components/AgentChat.tsx
 * Sams — Saiyam's RAG-powered portfolio AI agent.
 *
 * Rate limiting strategy (two layers):
 * Client — localStorage gives instant UX feedback (no spinner before rejection)
 * Server — HttpOnly cookie (primary) + browser fingerprint (fallback) stored
 * in Supabase. Immune to localStorage clearing, incognito, and VPN.
 *
 * Conversation history:
 * Every completed exchange is kept in state and forwarded to the backend so
 * Sams has context for follow-up messages like "ok", "hmm", "tell me more".
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ─── Browser fingerprint ──────────────────────────────────────────────────────
async function getDeviceFingerprint(): Promise<string> {
  const nav = navigator as Navigator & {
    deviceMemory?:     number
    connection?:       { effectiveType?: string }
    userAgentData?:    { platform?: string }
  }

  const components = [
    nav.userAgent,
    nav.language,
    nav.languages?.join(',') ?? '',
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(screen.pixelDepth ?? ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(nav.hardwareConcurrency ?? ''),
    String(nav.deviceMemory ?? ''),
    nav.connection?.effectiveType ?? '',
    nav.userAgentData?.platform ?? '',
    (() => {
      try {
        const c   = document.createElement('canvas')
        const ctx = c.getContext('2d')
        if (!ctx) return ''
        ctx.textBaseline = 'top'
        ctx.font          = '14px Arial'
        ctx.fillStyle     = '#FF4500'
        ctx.fillText('Sams🤖', 2, 2)
        return c.toDataURL().slice(-50)
      } catch { return '' }
    })(),
  ].join('|')

  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(components)
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

let fingerprintPromise: Promise<string> | null = null
function getCachedFingerprint(): Promise<string> {
  if (!fingerprintPromise) fingerprintPromise = getDeviceFingerprint()
  return fingerprintPromise
}

// ─── Client-side rate state (UX only — server is authoritative) ───────────────
const RATE_LIMIT = 10
const RATE_KEY   = 'sams_rl'

function getISOWeekKey(): string {
  const now  = new Date()
  const year = now.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const start = new Date(jan4)
  start.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

interface RateState { week: string; count: number }

function getRateState(): RateState {
  if (typeof window === 'undefined') return { week: '', count: 0 }
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (!raw) return { week: getISOWeekKey(), count: 0 }
    const parsed = JSON.parse(raw) as RateState
    return parsed.week !== getISOWeekKey() ? { week: getISOWeekKey(), count: 0 } : parsed
  } catch { return { week: getISOWeekKey(), count: 0 } }
}

function incrementLocalCount(): number {
  const state = getRateState()
  const next: RateState = { week: getISOWeekKey(), count: state.count + 1 }
  try { localStorage.setItem(RATE_KEY, JSON.stringify(next)) } catch {}
  return RATE_LIMIT - next.count
}

function syncLocalCount(serverRemaining: number): void {
  try {
    const serverCount = RATE_LIMIT - serverRemaining
    const state = getRateState()
    if (serverCount > state.count) {
      localStorage.setItem(
        RATE_KEY,
        JSON.stringify({ week: getISOWeekKey(), count: serverCount })
      )
    }
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id:       string
  role:     'user' | 'assistant'
  text:     string
  loading?: boolean
}

// Shape sent to the backend — Gemini uses 'model' not 'assistant'
interface HistoryTurn {
  role:    'user' | 'model'
  content: string
}

export interface AgentChatProps {
  open:           boolean
  onOpenChange:   (open: boolean) => void
  samsAvatarUrl?: string | null
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT  = '#FF4500'
const BG_CARD = 'var(--bg-card)'
const BORDER  = 'var(--border)'

// ─── Icons ────────────────────────────────────────────────────────────────────
function DefaultSamsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SamsAvatar({ url, size = 18 }: { url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt="Sams"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <DefaultSamsIcon size={size} />
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: 'var(--text-muted)',
            animation: `sams-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg, samsAvatarUrl }: { msg: Message; samsAvatarUrl?: string | null }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
          style={samsAvatarUrl ? { border: `1px solid ${BORDER}` } : { backgroundColor: ACCENT, boxShadow: '0 2px 8px rgba(255,69,0,0.3)' }}
        >
          <SamsAvatar url={samsAvatarUrl} size={samsAvatarUrl ? 28 : 14} />
        </div>
      )}
      <div className={cn('max-w-[85%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
        {msg.loading ? (
          <div className="px-3.5 py-2.5 rounded-2xl" style={{ backgroundColor: 'var(--bg-elevated)', border: `1px solid ${BORDER}` }}>
            <TypingDots />
          </div>
        ) : (
          <div
            className="px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed whitespace-pre-wrap"
            style={
              isUser
                ? { backgroundColor: ACCENT, color: '#fff', borderBottomRightRadius: 6, boxShadow: '0 4px 12px rgba(255,69,0,0.2)' }
                : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', borderBottomLeftRadius: 6, border: `1px solid ${BORDER}` }
            }
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}

const QUICK_PROMPTS = [
  { label: 'Research',    prompt: "Tell me about Saiyam's research work" },
  { label: 'Projects',    prompt: "What are Saiyam's key projects?" },
  { label: 'Skills',      prompt: "What is Saiyam's tech stack?" },
  { label: 'Patents',     prompt: "Does Saiyam have any patents?" },
  { label: 'Internships', prompt: "Where has Saiyam interned?" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts the local messages array into the history format the backend expects.
 * - Excludes loading placeholders and empty messages.
 * - Maps 'assistant' → 'model' (Gemini's role name).
 * - Caps at the last 16 messages (8 exchanges) — the backend caps at 8 too,
 * but trimming here keeps the request payload small.
 */
function buildHistory(messages: Message[]): HistoryTurn[] {
  return messages
    .filter(m => !m.loading && m.text.trim().length > 0)
    .slice(-16)
    .map(m => ({
      role:    m.role === 'user' ? 'user' : 'model',
      content: m.text,
    }))
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AgentChat({ open, onOpenChange, samsAvatarUrl }: AgentChatProps) {
  const [input,      setInput]      = useState('')
  const [messages,   setMessages]   = useState<Message[]>([])
  const [busy,       setBusy]       = useState(false)
  const [remaining,  setRemaining]  = useState<number | null>(null)
  const [rateDenied, setRateDenied] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Kick off fingerprint computation as soon as the component mounts
  useEffect(() => { getCachedFingerprint() }, [])

  useEffect(() => {
    const state = getRateState()
    setRemaining(Math.max(0, RATE_LIMIT - state.count))
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150) }, [open])
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return

    // Client-side gate for instant UX — server enforces the real limit
    const state = getRateState()
    if (state.count >= RATE_LIMIT) {
      setRateDenied(true)
      setRemaining(0)
      return
    }

    const userMsg: Message    = { id: `u-${Date.now()}`, role: 'user', text: text.trim() }
    const pendingId           = `a-${Date.now()}`
    const loadingMsg: Message = { id: pendingId, role: 'assistant', text: '', loading: true }

    // Snapshot history BEFORE adding the new user message — we want the prior
    // conversation as context, not the message we're about to send (that's the query).
    setMessages(prev => {
      const history = buildHistory(prev)

      // Fire the fetch inside the setState callback so history is always in sync.
      // We return the optimistic UI update immediately.
      ;(async () => {
        try {
          const fingerprint = await getCachedFingerprint()

          const res = await fetch('/api/sams/query', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query:                text.trim(),
              match_count:          5,
              fingerprint,
              conversation_history: history,
            }),
          })

          const data = await res.json()

          if (res.status === 429) {
            setRateDenied(true)
            setRemaining(0)
            syncLocalCount(0)
            setMessages(prev =>
              prev.map(m =>
                m.id === pendingId
                  ? { ...m, text: data.error ?? 'Weekly limit reached. Come back next Monday!', loading: false }
                  : m
              )
            )
            return
          }

          if (typeof data.remaining === 'number') {
            syncLocalCount(data.remaining)
            setRemaining(Math.max(0, data.remaining))
          } else {
            const left = incrementLocalCount()
            setRemaining(Math.max(0, left))
          }

          const answer: string = res.ok
            ? (data.answer ?? 'Sorry, I could not find an answer for that.')
            : (data.detail ?? data.message ?? data.error ?? 'Something went wrong. Please try again.')

          setMessages(prev =>
            prev.map(m => m.id === pendingId ? { ...m, text: answer, loading: false } : m)
          )
        } catch {
          setMessages(prev =>
            prev.map(m =>
              m.id === pendingId
                ? { ...m, text: 'Could not reach Sams. Please check your connection.', loading: false }
                : m
            )
          )
        } finally {
          setBusy(false)
        }
      })()

      return [...prev, userMsg, loadingMsg]
    })

    setInput('')
    setBusy(true)
    setRateDenied(false)
  }, [busy])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const clearChat = () => {
    setMessages([]); setInput(''); setBusy(false); setRateDenied(false)
  }

  if (!open) return null

  const canSend = !busy && !!input.trim() && (remaining === null || remaining > 0)

  return (
    <>
      <style>{`
        @keyframes sams-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30%            { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes sams-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-40 sm:hidden"
        style={{ backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
          'sm:bottom-6 sm:right-6 sm:left-auto sm:w-[400px]',
          'rounded-t-2xl sm:rounded-2xl',
        )}
        style={{
          backgroundColor: BG_CARD,
          border:          `1px solid ${BORDER}`,
          boxShadow:       '0 24px 60px rgba(0,0,0,0.7)',
          maxHeight:       'min(88dvh, 600px)',
          animation:       'sams-slide-up 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0" style={{ borderColor: BORDER }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
            style={samsAvatarUrl ? { border: `1px solid ${BORDER}` } : { backgroundColor: ACCENT, boxShadow: '0 2px 10px rgba(255,69,0,0.35)' }}
          >
            <SamsAvatar url={samsAvatarUrl} size={samsAvatarUrl ? 32 : 15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>Sams</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-body" style={{ color: 'var(--text-muted)' }}>
                AI · Saiyam's Portfolio Agent
                {remaining !== null && <span className="ml-1 opacity-60">· {remaining} q left this week</span>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearChat} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} title="Clear chat">
                <TrashIcon />
              </button>
            )}
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} aria-label="Close chat">
              <ChevronDownIcon />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" style={{ overscrollBehavior: 'contain' }} onWheel={e => e.stopPropagation()}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4 gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
                style={samsAvatarUrl ? { border: `1px solid ${BORDER}` } : { backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)', color: ACCENT }}
              >
                <SamsAvatar url={samsAvatarUrl} size={samsAvatarUrl ? 56 : 26} />
              </div>
              <div>
                <p className="font-heading font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Hey, I'm Sams!</p>
                <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Ask me anything about Saiyam — his research, projects, skills, or background.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q.label}
                    onClick={() => send(q.prompt)}
                    disabled={busy || remaining === 0}
                    className="px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-all duration-150 hover:scale-105 hover:text-white disabled:opacity-40"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: `1px solid ${BORDER}`, color: 'var(--text-secondary)' }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} samsAvatarUrl={samsAvatarUrl} />
          ))}

          {rateDenied && (
            <div
              className="text-center text-xs font-body py-2 px-3 rounded-lg"
              style={{ backgroundColor: 'rgba(255,69,0,0.1)', color: '#FF4500', border: '1px solid rgba(255,69,0,0.2)' }}
            >
              You've used all 10 questions for this week. Come back next Monday!
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 py-3 border-t" style={{ borderColor: BORDER }}>
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: 'var(--bg-input)', border: `1px solid ${BORDER}` }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={remaining === 0 ? 'Weekly limit reached — come back Monday' : 'Ask about research, projects, skills…'}
              rows={1}
              disabled={busy || remaining === 0}
              className="flex-1 bg-transparent text-sm font-body outline-none resize-none leading-relaxed disabled:opacity-60"
              style={{ color: 'var(--text-primary)', maxHeight: '120px', minHeight: '22px', overflowY: 'auto' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!canSend}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: canSend ? ACCENT : 'var(--bg-elevated)' }}
              aria-label="Send"
            >
              {busy ? (
                <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-18 0" />
                </svg>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
          <p className="text-[9px] font-body text-center mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for new line · 10 questions/week
          </p>
        </div>
      </div>
    </>
  )
}
