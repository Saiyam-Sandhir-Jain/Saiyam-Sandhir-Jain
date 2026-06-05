"""
services/supabase_db.py
───────────────────────
All Supabase interactions are isolated here:
  • insert_chunks()                  – batch-insert document chunks + embeddings
  • delete_chunks_by_slug()          – delete all chunks for a slug (for re-ingestion)
  • update_chunks_metadata_by_slug() – patch metadata fields via single RPC, no re-embedding
  • list_slugs()                     – summarise all slugs currently in the store
  • similarity_search()              – call the match_chunks RPC
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import AsyncClient, create_async_client

from config import Settings
from schemas import ChunkRecord, RetrievedChunk, SlugSummary

logger = logging.getLogger(__name__)

_TABLE = "document_chunks"
_RPC   = "match_chunks"
_PATCH_RPC = "patch_chunk_metadata"


class SupabaseService:
    """
    Async Supabase client wrapper.
    One instance is created at application startup and reused for the lifetime
    of the process (connection-pooling is handled internally by the supabase-py client).
    """

    def __init__(self, client: AsyncClient, settings: Settings) -> None:
        self._client  = client
        self._settings = settings

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    async def create(cls, settings: Settings) -> "SupabaseService":
        """Async factory: creates and validates the Supabase connection."""
        try:
            client: AsyncClient = await create_async_client(
                supabase_url=settings.supabase_url,
                supabase_key=settings.supabase_service_key,
            )
            logger.info("Supabase async client initialized (url=%s)", settings.supabase_url)
            return cls(client, settings)
        except Exception as exc:
            logger.critical("Failed to initialise Supabase client: %s", exc)
            raise

    # ── Write ──────────────────────────────────────────────────────────────────

    async def insert_chunks(self, chunks: list[ChunkRecord]) -> int:
        """
        Batch-insert a list of ChunkRecord objects into the document_chunks table.
        Returns the number of rows successfully inserted.
        """
        if not chunks:
            return 0

        rows: list[dict[str, Any]] = [
            {
                "content":   c.content,
                "metadata":  c.metadata,
                "embedding": c.embedding,
            }
            for c in chunks
        ]

        try:
            response = (
                await self._client
                .table(_TABLE)
                .insert(rows)
                .execute()
            )
            inserted = len(response.data) if response.data else 0
            logger.info("Inserted %d chunk(s) into %s", inserted, _TABLE)
            return inserted
        except Exception as exc:
            logger.error("DB insert failed: %s", exc)
            raise

    async def delete_chunks_by_slug(self, slug: str) -> int:
        """
        Delete all chunks whose metadata JSONB contains {"slug": slug}.
        Returns the number of rows deleted.
        """
        try:
            response = (
                await self._client
                .table(_TABLE)
                .delete()
                .eq("metadata->>slug", slug)
                .execute()
            )
            deleted = len(response.data) if response.data else 0
            logger.info("Deleted %d chunk(s) with slug='%s'", deleted, slug)
            return deleted
        except Exception as exc:
            logger.error("DB delete failed for slug '%s': %s", slug, exc)
            raise

    async def update_chunks_metadata_by_slug(
        self,
        slug: str,
        patch: dict[str, Any],
    ) -> int:
        """
        Merge *patch* into the metadata JSONB of every chunk with the given slug.
        Uses the patch_chunk_metadata Postgres RPC for a single UPDATE statement,
        avoiding the N+1 fetch-modify-push round-trips of the previous approach.
        Embeddings and chunk text are completely untouched.
        Returns the number of rows updated.
        """
        if not patch:
            return 0

        try:
            response = await (
                self._client
                .rpc(
                    _PATCH_RPC,
                    {
                        "p_slug":  slug,
                        "p_patch": patch,
                    },
                )
                .execute()
            )
            updated = int(response.data) if response.data is not None else 0
            logger.info(
                "Updated metadata for %d chunk(s) with slug='%s': %s",
                updated, slug, list(patch.keys()),
            )
            return updated
        except Exception as exc:
            logger.error(
                "Metadata update failed for slug '%s': %s", slug, exc
            )
            raise

    # ── Read ───────────────────────────────────────────────────────────────────

    async def list_slugs(self) -> list[SlugSummary]:
        """
        Return a summary of every distinct slug currently in the store:
        slug, volatility, version, last_updated, status, chunk count, last ingested.

        Implemented as a client-side aggregation over a lightweight select
        (metadata, created_at) — avoids a custom RPC while still being
        efficient because metadata is indexed on slug.
        """
        try:
            response = (
                await self._client
                .table(_TABLE)
                .select("metadata, created_at")
                .not_.is_("metadata->>slug", "null")
                .order("created_at", desc=True)
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            logger.error("list_slugs fetch failed: %s", exc)
            raise

        # Aggregate client-side
        seen: dict[str, SlugSummary] = {}
        for row in rows:
            meta = row.get("metadata") or {}
            slug = meta.get("slug")
            if not slug:
                continue

            if slug not in seen:
                seen[slug] = SlugSummary(
                    slug=slug,
                    volatility=meta.get("volatility"),
                    version=meta.get("version"),
                    last_updated=meta.get("last_updated"),
                    status=meta.get("status"),
                    chunk_count=0,
                    ingested_at=row.get("created_at"),
                )
            seen[slug].chunk_count += 1

        # Return sorted: live first, then slow, then frozen; then alpha within tier
        _order = {"live": 0, "slow": 1, "frozen": 2}
        return sorted(
            seen.values(),
            key=lambda s: (_order.get(s.volatility or "", 9), s.slug),
        )

    async def fetch_chunks_by_slugs(
        self,
        slugs: list[str],
        chunks_per_slug: int = 2,
    ) -> list[RetrievedChunk]:
        """
        Fetch the first `chunks_per_slug` chunks for each of the given slugs,
        ordered by chunk_index. Used by the slug-boost retrieval path in query.py
        to guarantee specific entity files are always present in the context window
        for keyword-matched queries, regardless of cosine similarity ranking.
        """
        if not slugs:
            return []

        results: list[RetrievedChunk] = []
        for slug in slugs:
            try:
                response = (
                    await self._client
                    .table(_TABLE)
                    .select("id, content, metadata")
                    .eq("metadata->>slug", slug)
                    .order("metadata->>chunk_index")
                    .limit(chunks_per_slug)
                    .execute()
                )
                for row in (response.data or []):
                    results.append(
                        RetrievedChunk(
                            id=row["id"],
                            content=row["content"],
                            metadata=row.get("metadata", {}),
                            similarity=1.0,  # boosted chunks are treated as exact matches
                        )
                    )
            except Exception as exc:
                logger.warning("fetch_chunks_by_slugs failed for slug '%s': %s", slug, exc)
                # Non-fatal per slug — skip and continue

        logger.info("fetch_chunks_by_slugs: fetched %d chunk(s) for %d slug(s)", len(results), len(slugs))
        return results

    async def similarity_search(
        self,
        query_embedding: list[float],
        match_threshold: float | None = None,
        match_count: int | None = None,
    ) -> list[RetrievedChunk]:
        """
        Call the match_chunks Postgres RPC and return typed results.
        """
        threshold = match_threshold if match_threshold is not None else self._settings.match_threshold
        count     = match_count     if match_count     is not None else self._settings.match_count

        try:
            response = await (
                self._client
                .rpc(
                    _RPC,
                    {
                        "query_embedding": query_embedding,
                        "match_threshold": threshold,
                        "match_count":     count,
                    },
                )
                .execute()
            )

            if not response.data:
                logger.info("Similarity search returned 0 results (threshold=%.2f).", threshold)
                return []

            results: list[RetrievedChunk] = [
                RetrievedChunk(
                    id=row["id"],
                    content=row["content"],
                    metadata=row.get("metadata", {}),
                    similarity=float(row["similarity"]),
                )
                for row in response.data
            ]
            logger.info("Similarity search returned %d chunk(s).", len(results))
            return results

        except Exception as exc:
            logger.error("Similarity search RPC failed: %s", exc)
            raise
