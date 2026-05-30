-- ============================================================
--  Migration: volatility support
--  Run in Supabase SQL Editor — safe to run on an existing table.
--
--  No new columns are needed — volatility, slug, version, and
--  last_updated are all stored inside the existing metadata JSONB
--  column alongside filename, chunk_index, etc.
--
--  This migration only adds an index to make delete-by-slug fast.
-- ============================================================

-- Index on metadata->>'slug' for efficient delete_chunks_by_slug queries.
-- Without this, deleting by slug requires a full table scan.
CREATE INDEX IF NOT EXISTS document_chunks_slug_idx
    ON document_chunks ((metadata->>'slug'))
    WHERE metadata->>'slug' IS NOT NULL;

-- ============================================================
--  What gets stored in metadata per chunk going forward:
--
--  All files:
--    filename     TEXT     – original filename (already present)
--    chunk_index  INT      – position within this file (already present)
--    total_chunks INT      – total chunks in this file (already present)
--    file_type    TEXT     – extension without dot (already present)
--
--  .md knowledge-base files (when slug is provided):
--    slug         TEXT     – stable identifier, e.g. "manifestai"
--    volatility   TEXT     – "frozen" | "slow" | "live"
--    version      INT      – incremented by caller on each meaningful edit
--    last_updated TEXT     – YYYY-MM of most recent substantive edit
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

-- Optional: useful query for checking what slugs are in the store
-- and when they were last updated.
--
-- SELECT
--     metadata->>'slug'         AS slug,
--     metadata->>'volatility'   AS volatility,
--     (metadata->>'version')::int AS version,
--     metadata->>'last_updated' AS last_updated,
--     COUNT(*)                  AS chunks,
--     MAX(created_at)           AS ingested_at
-- FROM document_chunks
-- WHERE metadata->>'slug' IS NOT NULL
-- GROUP BY 1, 2, 3, 4
-- ORDER BY ingested_at DESC;
