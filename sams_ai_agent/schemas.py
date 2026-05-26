"""
schemas.py
──────────
Pydantic v2 request / response models for the Sams portfolio RAG API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Ingestion ─────────────────────────────────────────────────────────────────

class ChunkRecord(BaseModel):
    """Internal representation of a single text chunk before DB insertion."""
    content:   str
    metadata:  dict[str, Any]
    embedding: list[float]


class IngestResponse(BaseModel):
    """Returned after a successful /api/ingest call."""
    filename:     str
    total_chunks: int
    message:      str = "Ingestion complete."


# ── Query ─────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    """Incoming payload for /api/query."""
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,            # keep inputs bounded; reduces injection surface
        description="A question for Sams about Saiyam Sandhir Jain.",
    )
    match_threshold: float | None = Field(
        default=None, ge=0.0, le=1.0,
        description="Override the default similarity threshold for this request.",
    )
    match_count: int | None = Field(
        default=None, ge=1, le=20,
        description="Override the default number of chunks to retrieve.",
    )

    @field_validator("query")
    @classmethod
    def strip_query(cls, v: str) -> str:
        return v.strip()


class RetrievedChunk(BaseModel):
    """A single chunk returned from the vector similarity search."""
    id:         UUID
    content:    str
    metadata:   dict[str, Any]
    similarity: float = Field(..., ge=0.0, le=1.0)


class QueryResponse(BaseModel):
    """Full response returned by /api/query."""
    query:             str
    answer:            str
    retrieved_chunks:  list[RetrievedChunk]
    model_used:        str
    chunks_retrieved:  int
    injection_blocked: bool = Field(
        default=False,
        description="True if the query was flagged as a prompt injection attempt.",
    )


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:    str      = "ok"
    assistant: str      = "Sams — Saiyam's portfolio assistant"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version:   str      = "1.0.0"
