"""
schemas.py
──────────
Pydantic v2 request / response models for the Sams portfolio RAG API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
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
    filename:       str
    total_chunks:   int
    message:        str = "Ingestion complete."
    # Volatility fields — populated only when slug was provided
    slug:           str | None = None
    volatility:     str | None = None
    deleted_chunks: int        = 0


class DeleteResponse(BaseModel):
    """Returned after a successful DELETE /api/ingest/{slug} call."""
    slug:           str
    deleted_chunks: int
    message:        str = "Chunks deleted."


class PatchMetadataRequest(BaseModel):
    """
    Payload for PATCH /api/ingest/{slug}.
    All fields are optional — only supplied fields are merged into existing metadata.
    The text and embeddings of existing chunks are left completely untouched.
    """
    volatility:   str | None = Field(
        default=None,
        description="New volatility tier: frozen | slow | live.",
    )
    version:      int | None = Field(
        default=None, ge=1,
        description="New version number.",
    )
    last_updated: str | None = Field(
        default=None,
        description="New last-updated month, YYYY-MM.",
    )
    status:       str | None = Field(
        default=None,
        description="Lifecycle status, e.g. completed | ongoing | published.",
    )

    @field_validator("volatility")
    @classmethod
    def validate_volatility(cls, v: str | None) -> str | None:
        if v is not None and v not in {"frozen", "slow", "live"}:
            raise ValueError("volatility must be one of: frozen, slow, live")
        return v

    @field_validator("last_updated")
    @classmethod
    def validate_last_updated(cls, v: str | None) -> str | None:
        if v is not None:
            import re
            if not re.fullmatch(r"\d{4}-\d{2}", v):
                raise ValueError("last_updated must be YYYY-MM")
        return v


class PatchMetadataResponse(BaseModel):
    """Returned after a successful PATCH /api/ingest/{slug} call."""
    slug:           str
    updated_chunks: int
    patch:          dict[str, Any]   # the fields that were actually changed
    message:        str = "Metadata updated."


class SlugSummary(BaseModel):
    """Summary row returned by GET /api/ingest/slugs for a single slug."""
    slug:         str
    volatility:   str | None = None
    version:      int | None = None
    last_updated: str | None = None
    status:       str | None = None
    chunk_count:  int        = 0
    ingested_at:  str | None = None   # ISO timestamp of most recent chunk insert


class SlugListResponse(BaseModel):
    """Returned by GET /api/ingest/slugs."""
    slugs: list[SlugSummary]
    total: int


# ── Query ─────────────────────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    """A single prior turn in the conversation, for multi-turn context."""
    role:    Literal["user", "model"] = Field(
        ...,
        description="'user' for visitor messages, 'model' for Sams responses.",
    )
    content: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The text content of the turn.",
    )


class QueryRequest(BaseModel):
    """Incoming payload for /api/query."""
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="A question or message for Sams about Saiyam Jain.",
    )
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list,
        max_length=20,
        description=(
            "Prior turns in this conversation, oldest first. "
            "Used to give Sams context for short follow-up messages like 'ok' or 'hmm'. "
            "Each item is {role: 'user'|'model', content: str}."
        ),
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
