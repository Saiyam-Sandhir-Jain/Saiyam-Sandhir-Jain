-- ============================================================
--  RAG Backend – Supabase / pgvector setup
--  Run this once in the Supabase SQL Editor.
-- ============================================================

-- 1. Enable the pgvector extension
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;


-- 2. Document chunks table
-- ─────────────────────────────────────────────────────────────
-- Drop & recreate only during initial setup.
-- For production migrations use ALTER TABLE instead.
CREATE TABLE IF NOT EXISTS document_chunks (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content   TEXT        NOT NULL,
    metadata  JSONB       NOT NULL DEFAULT '{}',
    embedding VECTOR(3072) NOT NULL,          -- change to 3072 if using gemini-embedding-exp-03-07
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast ANN (Approximate Nearest-Neighbour) cosine search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);          -- tune 'lists' ≈ sqrt(total_rows) for best performance


-- 3. Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────
-- Enable RLS on the table (no access at all until policies are added)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- ── 3a. Public READ ───────────────────────────────────────────
-- Anyone — including unauthenticated / anon-key callers — can
-- SELECT rows and call the match_chunks RPC (which does a SELECT).
CREATE POLICY "public_can_read_chunks"
    ON document_chunks
    FOR SELECT
    TO public                -- covers both anon and authenticated roles
    USING (true);

-- ── 3b. Authenticated INSERT ──────────────────────────────────
-- Only a signed-in user (JWT with role = authenticated) may add rows.
-- Your FastAPI backend uses the service-role key, which bypasses RLS
-- entirely, so ingestion always works. This policy protects direct
-- client-side calls (e.g. from a browser using the anon key).
CREATE POLICY "auth_can_insert_chunks"
    ON document_chunks
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ── 3c. Authenticated UPDATE ──────────────────────────────────
-- Only the authenticated role may update existing rows.
CREATE POLICY "auth_can_update_chunks"
    ON document_chunks
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ── 3d. Authenticated DELETE ──────────────────────────────────
-- Only the authenticated role may delete rows.
CREATE POLICY "auth_can_delete_chunks"
    ON document_chunks
    FOR DELETE
    TO authenticated
    USING (true);

-- ── 3e. Allow match_chunks RPC to run under anon role ─────────
-- The RPC function is defined as SECURITY INVOKER by default, meaning
-- it runs with the caller's privileges. Since we granted SELECT to
-- public above, anon callers can already use it.
-- If you ever change the function to SECURITY DEFINER, uncomment:
--
-- GRANT EXECUTE ON FUNCTION match_chunks(VECTOR, FLOAT, INT) TO anon;
-- GRANT EXECUTE ON FUNCTION match_chunks(VECTOR, FLOAT, INT) TO authenticated;


-- 4. RPC: match_chunks  (cosine similarity search)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding  VECTOR(3072),            -- must match table dimension
    match_threshold  FLOAT     DEFAULT 0.45,
    match_count      INT       DEFAULT 5
)
RETURNS TABLE (
    id         UUID,
    content    TEXT,
    metadata   JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE 1 - (dc.embedding <=> query_embedding) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding   -- ascending distance = descending similarity
    LIMIT match_count;
END;
$$;


-- ============================================================
--  To upgrade to 3072-dim embeddings later:
--
--  ALTER TABLE document_chunks
--      ALTER COLUMN embedding TYPE VECTOR(3072)
--      USING embedding::TEXT::VECTOR(3072);   -- only works if existing data is re-embedded
--
--  DROP FUNCTION IF EXISTS match_chunks;
--  -- Then recreate with VECTOR(3072) parameters above.
-- ============================================================
