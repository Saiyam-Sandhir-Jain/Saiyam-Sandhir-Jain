"""
routers/ingest.py
─────────────────
POST /api/ingest
  • Requires X-API-Key header matching INGEST_API_KEY in env.
  • Accepts a .txt file upload (max size configurable via MAX_UPLOAD_BYTES).
  • Splits the text into overlapping chunks.
  • Generates embeddings via Gemini.
  • Stores chunks + embeddings in Supabase.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, status

from config import Settings, get_settings
from schemas import ChunkRecord, IngestResponse
from services.gemini import GeminiService
from services.supabase_db import SupabaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Ingestion"])

_ALLOWED_CONTENT_TYPES = {"text/plain"}

# ── Authentication ────────────────────────────────────────────────────────────

async def _verify_ingest_key(
    x_api_key: str = Header(..., alias="X-API-Key", description="Secret key for the ingest endpoint."),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    FIX: Protect /api/ingest with a bearer-style API key so that only
    authorised callers (i.e. the portfolio owner) can push content into
    the vector store. Uses secrets.compare_digest to prevent timing attacks.
    """
    if not secrets.compare_digest(x_api_key, settings.ingest_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )


# ── Dependency helpers ────────────────────────────────────────────────────────

def _get_gemini(settings: Settings = Depends(get_settings)) -> GeminiService:
    return GeminiService(settings)


# ── Text chunking ─────────────────────────────────────────────────────────────

def split_into_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Split *text* into overlapping windows of *chunk_size* characters,
    stepping forward by (chunk_size - overlap) each iteration.

    The split prefers to break on a newline or space boundary to avoid
    cutting mid-word wherever possible.
    """
    if not text.strip():
        return []

    step = chunk_size - overlap
    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end < len(text):
            # Walk back up to 100 chars looking for a natural break
            break_at = text.rfind("\n", start, end)
            if break_at == -1 or break_at <= start:
                break_at = text.rfind(" ", start, end)
            if break_at > start:
                end = break_at + 1          # include the whitespace/newline

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start += step

    return chunks


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a .txt document into the vector store.",
)
async def ingest_document(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
    gemini: GeminiService = Depends(_get_gemini),
    _auth: None = Depends(_verify_ingest_key),   # FIX: require API key
) -> IngestResponse:
    # ── Validate file type ────────────────────────────────────────────────────
    # FIX: Check both filename extension AND the declared Content-Type header.
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only plain-text (.txt) files are supported.",
        )
    if file.content_type and file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only plain-text (.txt) files are supported.",
        )

    # ── Read file with size guard ─────────────────────────────────────────────
    # FIX: Read one byte beyond the limit so we can detect oversized uploads
    # without loading the entire file into memory first.
    try:
        raw_bytes = await file.read(settings.max_upload_bytes + 1)
    except Exception:
        logger.exception("Failed to read uploaded file '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded file. Ensure it is a valid UTF-8 encoded .txt file.",
        )
    finally:
        await file.close()

    # FIX: Enforce upload size limit.
    if len(raw_bytes) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {limit_mb} MB.",
        )

    try:
        text = raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        logger.exception("Failed to decode uploaded file '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded file. Ensure it is a valid UTF-8 encoded .txt file.",
        )

    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    # ── Chunk ─────────────────────────────────────────────────────────────────
    chunks = split_into_chunks(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text chunks could be extracted from the file.",
        )

    logger.info("File '%s': %d chunk(s) created.", file.filename, len(chunks))

    # ── Embed ─────────────────────────────────────────────────────────────────
    # FIX: Do not surface raw exception messages to the client.
    try:
        embeddings = await gemini.embed_texts(chunks)
    except Exception:
        logger.exception("Gemini embedding failed for file '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate embeddings. Please try again later.",
        )

    # ── Build records ─────────────────────────────────────────────────────────
    records: list[ChunkRecord] = [
        ChunkRecord(
            content=chunk,
            metadata={
                "filename": file.filename,
                "chunk_index": idx,
                "total_chunks": len(chunks),
            },
            embedding=embedding,
        )
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    # ── Persist to Supabase ───────────────────────────────────────────────────
    from main import get_supabase_service  # noqa: PLC0415 – avoids circular import at module load

    db: SupabaseService = await get_supabase_service()
    try:
        await db.insert_chunks(records)
    except Exception:
        logger.exception("DB insert failed for file '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to store document chunks. Please try again later.",
        )

    return IngestResponse(filename=file.filename, total_chunks=len(records))
