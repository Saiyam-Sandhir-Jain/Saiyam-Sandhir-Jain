"""
services/supabase_db.py
───────────────────────
All Supabase interactions are isolated here:
  • insert_chunks()    – batch-insert document chunks + embeddings
  • similarity_search() – call the match_chunks RPC
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import AsyncClient, create_async_client

from config import Settings
from schemas import ChunkRecord, RetrievedChunk

logger = logging.getLogger(__name__)

_TABLE = "document_chunks"
_RPC = "match_chunks"


class SupabaseService:
    """
    Async Supabase client wrapper.
    One instance is created at application startup and reused for the lifetime
    of the process (connection-pooling is handled internally by the supabase-py client).
    """

    def __init__(self, client: AsyncClient, settings: Settings) -> None:
        self._client = client
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
        Raises on any DB or network error (let callers handle it).
        """
        if not chunks:
            return 0

        rows: list[dict[str, Any]] = [
            {
                "content": c.content,
                "metadata": c.metadata,
                "embedding": c.embedding,     # list[float] – pgvector accepts JSON arrays
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

    # ── Read ───────────────────────────────────────────────────────────────────

    async def similarity_search(
        self,
        query_embedding: list[float],
        match_threshold: float | None = None,
        match_count: int | None = None,
    ) -> list[RetrievedChunk]:
        """
        Call the match_chunks Postgres RPC and return typed results.

        Parameters are optional and fall back to values set in Settings.
        """
        threshold = match_threshold if match_threshold is not None else self._settings.match_threshold
        count = match_count if match_count is not None else self._settings.match_count

        try:
            response = await (
                self._client
                .rpc(
                    _RPC,
                    {
                        "query_embedding": query_embedding,
                        "match_threshold": threshold,
                        "match_count": count,
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
