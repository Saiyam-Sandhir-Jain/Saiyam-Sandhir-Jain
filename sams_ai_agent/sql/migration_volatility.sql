-- ============================================================
--  Migration: volatility support + performance fixes
--  Run in Supabase SQL Editor — safe to run on an existing table.
--
--  No new columns are needed — volatility, slug, version, and
--  last_updated are all stored inside the existing metadata JSONB
--  column alongside filename, chunk_index, etc.
--
--  This migration:
--    1. Adds an index on metadata->>'slug'  (already safe to re-run)
--    2. Adds an index on metadata->>'volatility'  (NEW — speeds up
--       targeted re-ingestion sweeps like --volatility live)
--    3. Creates the patch_chunk_metadata RPC  (NEW — replaces the
--       N+1 fetch-modify-push loop in the Python client with a single
--       server-side UPDATE)
--    4. Recreates match_chunks with halfvec(3072) parameter type to
--       match the actual column type and eliminate the implicit cast
--       that was happening on every query
-- ============================================================

-- 1. Slug index — fast delete/patch/list queries
CREATE INDEX IF NOT EXISTS document_chunks_slug_idx
    ON document_chunks ((metadata->>'slug'))
    WHERE metadata->>'slug' IS NOT NULL;

-- 2. Volatility index — fast targeted re-ingestion sweeps  ← NEW
CREATE INDEX IF NOT EXISTS document_chunks_volatility_idx
    ON document_chunks ((metadata->>'volatility'))
    WHERE metadata->>'volatility' IS NOT NULL;

-- 3. patch_chunk_metadata RPC — single-query metadata merge  ← NEW
--    Replaces the N+1 loop in update_chunks_metadata_by_slug().
--    The || operator is a shallow JSONB merge: existing keys not in
--    p_patch are preserved; keys in p_patch overwrite their counterparts.
CREATE OR REPLACE FUNCTION patch_chunk_metadata(
    p_slug   TEXT,
    p_patch  JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    affected INT;
BEGIN
    UPDATE document_chunks
    SET    metadata = metadata || p_patch
    WHERE  metadata->>'slug' = p_slug;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

-- 4. Fix match_chunks: change parameter type from vector(3072) to
--    halfvec(3072) to match the actual column type.
--    The old function used VECTOR which caused an implicit cast on
--    every similarity query. This recreates it with the correct type.
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding  halfvec(3072),
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
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
--  What gets stored in metadata per chunk:
--
--  All files:
--    filename     TEXT     – original filename
--    chunk_index  INT      – position within this file
--    total_chunks INT      – total chunks in this file
--    file_type    TEXT     – extension without dot
--
--  .md knowledge-base files (when slug is provided):
--    slug         TEXT     – stable identifier, e.g. "manifestai"
--    volatility   TEXT     – "frozen" | "slow" | "live"
--    version      INT      – incremented on each meaningful edit
--    last_updated TEXT     – YYYY-MM of most recent substantive edit
--    status       TEXT     – completed | ongoing | published | etc.
--
--  Example row metadata:
--  {
--    "filename":     "projects/manifestai.md",
--    "chunk_index":  0,
--    "total_chunks": 5,
--    "file_type":    "md",
--    "slug":         "manifestai",
--    "volatility":   "live",
--    "version":      3,
--    "last_updated": "2025-06"
--  }
-- ============================================================

-- Useful diagnostic query — check what slugs are in the store:
--
-- SELECT
--     metadata->>'slug'                 AS slug,
--     metadata->>'volatility'           AS volatility,
--     (metadata->>'version')::int       AS version,
--     metadata->>'last_updated'         AS last_updated,
--     metadata->>'status'               AS status,
--     COUNT(*)                          AS chunks,
--     MAX(created_at)                   AS ingested_at
-- FROM document_chunks
-- WHERE metadata->>'slug' IS NOT NULL
-- GROUP BY 1, 2, 3, 4, 5
-- ORDER BY ingested_at DESC;
