-- ============================================================
-- Chat History Table
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- ─── chat_sessions — one row per visitor session ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token text NOT NULL,           -- hashed device token (same as rate-limit)
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_active  timestamptz NOT NULL DEFAULT now()
);

-- ─── chat_messages — individual turns ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-session retrieval (most recent first)
CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON public.chat_messages (session_id, created_at DESC);

-- Index for looking up sessions by device token
CREATE INDEX IF NOT EXISTS chat_sessions_device_token_idx
  ON public.chat_sessions (device_token);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Service-role key (used by the Next.js API route) bypasses RLS,
-- so these policies are a safety net for any direct client access.
CREATE POLICY "No direct client read sessions"
  ON public.chat_sessions FOR SELECT TO anon USING (false);

CREATE POLICY "No direct client read messages"
  ON public.chat_messages FOR SELECT TO anon USING (false);

-- Authenticated (admin) can read everything for analytics
CREATE POLICY "Auth read sessions"
  ON public.chat_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth read messages"
  ON public.chat_messages FOR SELECT TO authenticated USING (true);
