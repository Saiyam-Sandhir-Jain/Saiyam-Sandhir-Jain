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

    # ── CORS ──────────────────────────────────────────────────
    # Stored as a plain str to avoid pydantic-settings v2 attempting json.loads()
    # on a list[str] field before any validator runs (which crashes on a
    # comma-separated value like "https://a.com,https://b.com").
    # main.py calls settings.parsed_origins to get the actual list.
    allowed_origins: str = Field(
        default="http://localhost:3000",
        description=(
            "Comma-separated list of allowed CORS origins. "
            "e.g. https://yourportfolio.com,https://www.yourportfolio.com"
        ),
    )

    # ── Security ──────────────────────────────────────────────
    ingest_api_key: str = Field(
        ...,
        description=(
            "Secret key required in the X-API-Key header to call POST /api/ingest. "
            "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        ),
    )

    # ── Uploads ───────────────────────────────────────────────
    max_upload_bytes: int = Field(
        default=5 * 1024 * 1024,   # 5 MB
        description="Maximum allowed size of an uploaded .txt file in bytes.",
    )

    # ── Runtime environment ───────────────────────────────────
    environment: str = Field(
        default="production",
        description=(
            "Set to 'development' to enable /docs and /redoc endpoints. "
            "Always 'production' in deployed environments."
        ),
    )

    # ── Validators ────────────────────────────────────────────

    @field_validator("chunk_overlap")
    @classmethod
    def overlap_must_be_less_than_chunk(cls, v: int, info) -> int:
        chunk_size = info.data.get("chunk_size", 1000)
        if v >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")
        return v

    @property
    def parsed_origins(self) -> list[str]:
        """Parse the comma-separated ALLOWED_ORIGINS string into a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    return Settings()
