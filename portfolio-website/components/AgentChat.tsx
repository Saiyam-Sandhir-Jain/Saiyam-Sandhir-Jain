'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { portfolioEvents } from '@/lib/portfolio-events'

// ─── Types ────────────────────────────────────────────────────────────────
interface ToolCall {
  name: string
  args: Record<string, unknown>
}

interface Message {
  id:        string
  role:      'user' | 'assistant'
  text:      string
  toolCall?: ToolCall
  streaming?: boolean
}

// ─── Design tokens ────────────────────────────────────────────────────────
const ACCENT  = '#FF4500'
const BG_CARD = '#1c1a18'
const BORDER  = 'rgba(255,255,255,0.09)'

// ─── Icons ────────────────────────────────────────────────────────────────
function BotIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M12 11V7"/><circle cx="12" cy="5" r="2"/>
      <path d="M8 15h.01M12 15h.01M16 15h.01"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.35)',
            animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Tool call pill ───────────────────────────────────────────────────────
function ToolPill({ call }: { call: ToolCall }) {
  const label =
    call.name === 'update_portfolio_ui'
      ? `↗ ${call.args.action ?? 'navigate'} → ${call.args.target}${call.args.componentId ? ` / ${call.args.componentId}` : ''}`
      : '↗ Fetching GitHub stats…'

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading font-semibold tracking-wide mb-1.5"
      style={{
        backgroundColor: 'rgba(255,69,0,0.12)',
        border: '1px solid rgba(255,69,0,0.25)',
        color: '#FF6A30',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>
      </svg>
      {label}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {/* Avatar (assistant only) */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: ACCENT, boxShadow: '0 2px 8px rgba(255,69,0,0.3)' }}
        >
          <BotIcon size={14} />
        </div>
      )}

      <div className={cn('max-w-[85%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
        {/* Tool call pill */}
        {msg.toolCall && <ToolPill call={msg.toolCall} />}

        {/* Text bubble */}
        {(msg.text || msg.streaming) && (
          <div
            className="px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed"
            style={
              isUser
                ? {
                    backgroundColor: ACCENT,
                    color: '#fff',
                    borderBottomRightRadius: 6,
                    boxShadow: '0 4px 12px rgba(255,69,0,0.2)',
                  }
                : {
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    color: '#e4e4e7',
                    borderBottomLeftRadius: 6,
                    border: `1px solid ${BORDER}`,
                  }
            }
          >
            {msg.text}
            {msg.streaming && msg.text && (
              <span
                className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
                style={{ backgroundColor: ACCENT }}
              />
            )}
          </div>
        )}

        {/* Typing indicator (no text yet) */}
        {!msg.text && msg.streaming && (
          <div
            className="px-3.5 py-2.5 rounded-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}` }}
          >
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Quick prompts ────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Projects',  prompt: 'Show me your key projects' },
  { label: 'Research',  prompt: 'Tell me about your research work' },
  { label: 'Skills',    prompt: "What's your tech stack?" },
  { label: 'GitHub',    prompt: 'Show my GitHub stats' },
]

// ─── Gemini conversation history shape ────────────────────────────────────
interface GeminiPart    { text: string }
interface GeminiMessage { role: 'user' | 'model'; parts: GeminiPart[] }

// ─── Props ────────────────────────────────────────────────────────────────
interface AgentChatProps {
  /** Whether the chat panel is open. Controlled externally (SJ logo click). */
  open: boolean
  /** Callback to update open state (e.g., when user closes the panel). */
  onOpenChange: (open: boolean) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── AgentChat Component ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export default function AgentChat({ open, onOpenChange }: AgentChatProps) {
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [history,  setHistory]  = useState<GeminiMessage[]>([])
  const [busy,     setBusy]     = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  // Escape key closes panel
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  // ── Send message ────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return

    const userMsg: Message = {
      id:   `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
    }

    const assistantId = `a-${Date.now()}`
    const pendingMsg: Message = {
      id:        assistantId,
      role:      'assistant',
      text:      '',
      streaming: true,
    }

    setMessages(prev => [...prev, userMsg, pendingMsg])
    setInput('')
    setBusy(true)

    const newHistory: GeminiMessage[] = [
      ...history,
      { role: 'user', parts: [{ text: text.trim() }] },
    ]

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: newHistory }),
        signal:  controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader   = res.body.getReader()
      const decoder  = new TextDecoder()
      let textBuffer = ''
      let fullText   = ''
      let toolCall: ToolCall | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        textBuffer += decoder.decode(value, { stream: true })
        const lines = textBuffer.split('\n')
        textBuffer  = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'text_delta') {
              fullText += event.text
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, text: fullText, streaming: true } : m
                )
              )
            }

            if (event.type === 'tool_call') {
              toolCall = { name: event.call.name, args: event.call.args ?? {} }

              // Dispatch UI event immediately
              if (event.call.name === 'update_portfolio_ui') {
                portfolioEvents.emit({
                  action:      event.call.args?.action ?? 'navigate',
                  target:      event.call.args?.target ?? 'home',
                  componentId: event.call.args?.componentId,
                })
              }

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, toolCall, streaming: true } : m
                )
              )
            }

            if (event.type === 'done')  fullText = event.fullText ?? fullText
            if (event.type === 'error') fullText = event.message
          } catch { /* partial JSON, skip */ }
        }
      }

      // Finalise
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, text: fullText, toolCall, streaming: false }
            : m
        )
      )

      setHistory([
        ...newHistory,
        { role: 'model', parts: [{ text: fullText }] },
      ])
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, text: 'I ran into an error. Please try again.', streaming: false }
            : m
        )
      )
    } finally {
      setBusy(false)
    }
  }, [busy, history])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearChat = () => {
    setMessages([])
    setHistory([])
    setInput('')
  }

  if (!open) return null

  return (
    <>
      {/* ── Keyframes (injected once) ────────────────────────────────── */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30%            { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      {/* ── Mobile backdrop ──────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-40 sm:hidden"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={() => onOpenChange(false)}
      />

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      {/*
        Mobile  : full-width bottom sheet (left-0 right-0 bottom-0)
        Desktop : floating bottom-right card (sm:w-[400px] sm:right-6 sm:bottom-6)
      */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
          'sm:bottom-6 sm:right-6 sm:left-auto sm:w-[400px]',
          'rounded-t-2xl sm:rounded-2xl',
        )}
        style={{
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          maxHeight: 'min(88dvh, 600px)',
          animation: 'chat-slide-up 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0"
          style={{ borderColor: BORDER }}
        >
          {/* Agent avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: ACCENT, boxShadow: '0 2px 10px rgba(255,69,0,0.35)' }}
          >
            <BotIcon size={15} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold text-white text-sm leading-none">
              Saiyam's Agent
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-zinc-500 text-[10px] font-body">AI · Portfolio Agent</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors"
                title="Clear chat"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <ChevronDownIcon />
            </button>
          </div>
        </div>

        {/* ── Messages area ────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Welcome / empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-4 gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(255,69,0,0.1)',
                  border: '1px solid rgba(255,69,0,0.2)',
                  color: ACCENT,
                }}
              >
                <BotIcon size={26} />
              </div>
              <div>
                <p className="font-heading font-bold text-white text-sm mb-1">Ask me anything</p>
                <p className="text-zinc-500 text-xs font-body leading-relaxed">
                  I can navigate the portfolio, explain projects, and pull live GitHub stats.
                </p>
              </div>

              {/* Quick prompts */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q.label}
                    onClick={() => send(q.prompt)}
                    className="px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-all duration-150 hover:scale-105 hover:text-white"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${BORDER}`,
                      color: 'rgba(212,212,216,1)',
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input area ───────────────────────────────────────────── */}
        <div
          className="shrink-0 px-3 py-3 border-t"
          style={{ borderColor: BORDER }}
        >
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: `1px solid ${BORDER}`,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about projects, research, skills…"
              rows={1}
              disabled={busy}
              className="flex-1 bg-transparent text-sm font-body text-white placeholder-zinc-600 outline-none resize-none leading-relaxed disabled:opacity-60"
              style={{ maxHeight: '120px', minHeight: '22px', overflowY: 'auto' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: input.trim() && !busy ? ACCENT : 'rgba(255,255,255,0.08)',
              }}
              aria-label="Send message"
            >
              {busy ? (
                <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-18 0"/>
                </svg>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
          <p className="text-zinc-700 text-[9px] font-body text-center mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}
