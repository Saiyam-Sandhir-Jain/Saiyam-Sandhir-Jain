"""
routers/ingest.py
─────────────────
POST /api/ingest
  • Accepts a .txt file upload.
  • Splits the text into overlapping chunks.
  • Generates embeddings via Gemini.
  • Stores chunks + embeddings in Supabase.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from config import Settings, get_settings
from schemas import ChunkRecord, IngestResponse
from services.gemini import GeminiService
from services.supabase_db import SupabaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Ingestion"])

# ── Dependency helpers (resolved from app.state in main.py) ──────────────────

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
) -> IngestResponse:
    # ── Validate file type ────────────────────────────────────────────────────
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only plain-text (.txt) files are supported.",
        )

    # ── Read file ─────────────────────────────────────────────────────────────
    try:
        raw_bytes = await file.read()
        text = raw_bytes.decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error("Failed to read uploaded file '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read file: {exc}",
        )
    finally:
        await file.close()

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
    try:
        embeddings = await gemini.embed_texts(chunks)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini embedding API error: {exc}",
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
    # SupabaseService is retrieved from app.state (initialised in lifespan).
    # We use a local import here to access app.state via the request; the cleaner
    # approach is to use a Request-level dependency (see main.py).
    from main import get_supabase_service  # noqa: PLC0415 – avoids circular import at module load

    db: SupabaseService = await get_supabase_service()
    try:
        await db.insert_chunks(records)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Database insert error: {exc}",
        )

    return IngestResponse(filename=file.filename, total_chunks=len(records))
