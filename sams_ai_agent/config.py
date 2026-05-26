"""
config.py
─────────
Single source of truth for all environment-driven settings.
Loaded once at startup and injected wherever needed.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # ignore any keys present in .env but not declared here
        case_sensitive=False,
    )

    # ── Supabase ──────────────────────────────────────────────
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_key: str = Field(..., description="Supabase service-role key (bypasses RLS)")

    # ── Gemini ────────────────────────────────────────────────
    gemini_api_key: str = Field(..., description="Google AI Studio API key")
    gemini_chat_model: str = Field(default="gemini-2.5-flash")
    gemini_embedding_model: str = Field(default="gemini-embedding-001")

    # ── Vector / Table ────────────────────────────────────────
    embedding_dimensions: int = Field(
        default=768,
        description=(
            "Must match the VECTOR() dimension in the DB. "
            "768 for gemini-embedding-001; 3072 for gemini-embedding-exp-03-07."
        ),
    )

    # ── Chunking ──────────────────────────────────────────────
    chunk_size: int = Field(default=1000, ge=100, le=8000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)

    # ── Retrieval ─────────────────────────────────────────────
    match_threshold: float = Field(default=0.45, ge=0.0, le=1.0)
    match_count: int = Field(default=5, ge=1, le=20)

    @field_validator("chunk_overlap")
    @classmethod
    def overlap_must_be_less_than_chunk(cls, v: int, info) -> int:
        chunk_size = info.data.get("chunk_size", 1000)
        if v >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    return Settings()
