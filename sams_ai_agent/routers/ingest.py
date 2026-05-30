"""
routers/ingest.py
─────────────────
POST   /api/ingest
  • Accepts any supported file type, extracts text, chunks, embeds, stores.
  • Optional volatility metadata (slug, volatility, version, last_updated)
    for .md knowledge-base files.  When a slug is supplied, all existing
    chunks for that slug are deleted before inserting (upsert-by-slug).
    This applies regardless of volatility tier — frozen files can be
    re-ingested to fix transcription errors; the caller is responsible for
    only doing so intentionally.

DELETE /api/ingest/{slug}
  • Deletes all chunks whose metadata->>'slug' equals slug.

PATCH  /api/ingest/{slug}
  • Merges supplied fields (volatility, version, last_updated, status) into
    the metadata of every chunk for that slug.
  • Embeddings and text are NOT touched — no re-embedding needed.

GET    /api/ingest/slugs
  • Returns a summary of every slug currently in the store (volatility,
    version, last_updated, status, chunk count, last ingested).

Supported file types
─────────────────────
  Plain text : .txt  .md  .markdown  .csv  .tsv  .log  .yaml  .yml  .json
               .html  .htm  .rst  .xml
  Documents  : .pdf  .docx
  Images     : .jpg  .jpeg  .png  .webp  .gif
"""

from __future__ import annotations

import io
import logging
import secrets
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Form, Header, HTTPException, UploadFile, status

from config import Settings, get_settings
from schemas import (
    ChunkRecord,
    DeleteResponse,
    IngestResponse,
    PatchMetadataRequest,
    PatchMetadataResponse,
    SlugListResponse,
)
from services.gemini import GeminiService
from services.supabase_db import SupabaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Ingestion"])

# ── Supported types ───────────────────────────────────────────────────────────

_TEXT_EXTENSIONS: frozenset[str] = frozenset({
    ".txt", ".md", ".markdown",
    ".csv", ".tsv",
    ".log",
    ".yaml", ".yml",
    ".json",
    ".html", ".htm",
    ".rst",
    ".xml",
})

_PDF_EXTENSIONS:   frozenset[str] = frozenset({".pdf"})
_DOCX_EXTENSIONS:  frozenset[str] = frozenset({".docx"})
_IMAGE_EXTENSIONS: frozenset[str] = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})

_IMAGE_MIME: dict[str, str] = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
    ".gif":  "image/gif",
}

_ALL_SUPPORTED: frozenset[str] = (
    _TEXT_EXTENSIONS | _PDF_EXTENSIONS | _DOCX_EXTENSIONS | _IMAGE_EXTENSIONS
)

_VALID_VOLATILITY = frozenset({"frozen", "slow", "live"})

# ── Authentication ────────────────────────────────────────────────────────────

async def _verify_ingest_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not secrets.compare_digest(x_api_key, settings.ingest_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )


# ── Dependency helpers ────────────────────────────────────────────────────────

def _get_gemini(settings: Settings = Depends(get_settings)) -> GeminiService:
    return GeminiService(settings)


async def _get_db() -> SupabaseService:
    from main import get_supabase_service  # noqa: PLC0415
    return await get_supabase_service()


# ── Text extraction ───────────────────────────────────────────────────────────

async def _extract_text(raw_bytes: bytes, filename: str, gemini: GeminiService) -> str:
    ext = Path(filename).suffix.lower()

    if ext in _TEXT_EXTENSIONS:
        return raw_bytes.decode("utf-8", errors="replace")

    if ext in _PDF_EXTENSIONS:
        try:
            import pypdf
        except ImportError as exc:
            raise RuntimeError("pypdf is required: pip install pypdf") from exc
        reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
        pages  = [p.extract_text() or "" for p in reader.pages]
        text   = "\n\n".join(p for p in pages if p.strip())
        if not text.strip():
            raise ValueError("No extractable text found in this PDF.")
        return text

    if ext in _DOCX_EXTENSIONS:
        try:
            import docx
        except ImportError as exc:
            raise RuntimeError("python-docx is required: pip install python-docx") from exc
        doc  = docx.Document(io.BytesIO(raw_bytes))
        text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        if not text.strip():
            raise ValueError("No extractable text found in this .docx file.")
        return text

    if ext in _IMAGE_EXTENSIONS:
        mime_type   = _IMAGE_MIME[ext]
        description = await gemini.describe_image(raw_bytes, mime_type)
        if not description.strip():
            raise ValueError("Gemini vision returned no content for this image.")
        return f"[Image: {filename}]\n\n{description}"

    raise ValueError(f"Unsupported file extension: {ext!r}")


# ── Text chunking ─────────────────────────────────────────────────────────────

def split_into_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    if not text.strip():
        return []
    step   = chunk_size - overlap
    chunks: list[str] = []
    start  = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            break_at = text.rfind("\n", start, end)
            if break_at == -1 or break_at <= start:
                break_at = text.rfind(" ", start, end)
            if break_at > start:
                end = break_at + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += step
    return chunks


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get(
    "/ingest/slugs",
    response_model=SlugListResponse,
    summary="List all slugs currently in the vector store.",
    description=(
        "Returns a summary of every distinct slug: volatility tier, version, "
        "last_updated, status, chunk count, and last ingestion timestamp. "
        "Requires X-API-Key authentication."
    ),
)
async def list_slugs(
    _auth: None = Depends(_verify_ingest_key),
    db: SupabaseService = Depends(_get_db),
) -> SlugListResponse:
    try:
        slugs = await db.list_slugs()
    except Exception:
        logger.exception("Failed to list slugs")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch slug list from the store.",
        )
    return SlugListResponse(slugs=slugs, total=len(slugs))


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a document or image into the vector store.",
)
async def ingest_document(
    file: UploadFile,
    slug:         str | None = Form(default=None),
    volatility:   str | None = Form(default=None),
    version:      int | None = Form(default=None),
    last_updated: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    gemini: GeminiService = Depends(_get_gemini),
    _auth: None = Depends(_verify_ingest_key),
    db: SupabaseService = Depends(_get_db),
) -> IngestResponse:
    # ── Validate file ─────────────────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Uploaded file has no filename.")

    ext = Path(file.filename).suffix.lower()
    if ext not in _ALL_SUPPORTED:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type: {ext!r}. Supported: {', '.join(sorted(_ALL_SUPPORTED))}",
        )

    # ── Validate volatility ───────────────────────────────────────────────────
    resolved_volatility = "slow"
    if volatility is not None:
        if volatility not in _VALID_VOLATILITY:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Invalid volatility {volatility!r}. Must be one of: frozen, slow, live.",
            )
        resolved_volatility = volatility

    # ── Read + size guard ─────────────────────────────────────────────────────
    try:
        raw_bytes = await file.read(settings.max_upload_bytes + 1)
    except Exception:
        logger.exception("Failed to read uploaded file '%s'", file.filename)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read the uploaded file.")
    finally:
        await file.close()

    if len(raw_bytes) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {limit_mb} MB limit.")

    # ── Extract ───────────────────────────────────────────────────────────────
    try:
        text = await _extract_text(raw_bytes, file.filename, gemini)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))
    except Exception:
        logger.exception("Text extraction failed for '%s'", file.filename)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Could not extract text from the uploaded file.")

    if not text.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No text could be extracted from the uploaded file.")

    # ── Chunk ─────────────────────────────────────────────────────────────────
    chunks = split_into_chunks(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No text chunks could be extracted.")

    logger.info("File '%s': %d chunk(s) created.", file.filename, len(chunks))

    # ── Embed ─────────────────────────────────────────────────────────────────
    try:
        embeddings = await gemini.embed_texts(chunks)
    except Exception:
        logger.exception("Gemini embedding failed for '%s'", file.filename)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to generate embeddings. Please try again later.")

    # ── Build records ─────────────────────────────────────────────────────────
    records: list[ChunkRecord] = [
        ChunkRecord(
            content=chunk,
            metadata={
                "filename":     file.filename,
                "chunk_index":  idx,
                "total_chunks": len(chunks),
                "file_type":    ext.lstrip("."),
                **({
                    "slug":         slug,
                    "volatility":   resolved_volatility,
                    **({"version":      version}      if version is not None else {}),
                    **({"last_updated": last_updated}  if last_updated        else {}),
                } if slug else {}),
            },
            embedding=embedding,
        )
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    # ── Delete existing chunks for this slug (upsert-by-slug) ────────────────
    # Always delete regardless of volatility tier.  Volatility controls how
    # OFTEN a file should be re-ingested (operational guidance), not whether
    # re-ingestion is allowed.  Skipping deletion for frozen files caused
    # duplicate chunks when re-ingesting to fix a transcription error.
    deleted = 0
    if slug:
        try:
            deleted = await db.delete_chunks_by_slug(slug)
            if deleted:
                logger.info("Deleted %d existing chunk(s) for slug '%s'.", deleted, slug)
        except Exception:
            logger.exception("Failed to delete existing chunks for slug '%s'", slug)
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to clear existing chunks before re-ingestion.")

    # ── Insert ────────────────────────────────────────────────────────────────
    try:
        await db.insert_chunks(records)
    except Exception:
        logger.exception("DB insert failed for '%s'", file.filename)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to store document chunks. Please try again later.")

    return IngestResponse(
        filename=file.filename,
        total_chunks=len(records),
        slug=slug,
        volatility=resolved_volatility,
        deleted_chunks=deleted,
    )


@router.patch(
    "/ingest/{slug}",
    response_model=PatchMetadataResponse,
    summary="Update metadata fields for all chunks of a slug — no re-embedding.",
    description=(
        "Merges the supplied fields (volatility, version, last_updated, status) "
        "into the metadata of every chunk that belongs to this slug. "
        "The chunk text and embeddings are left completely untouched, so no "
        "Gemini API calls are made. Use this to mark a project as completed, "
        "change a volatility tier, or bump a version without re-ingesting. "
        "Requires X-API-Key authentication."
    ),
)
async def patch_slug_metadata(
    slug: str,
    body: PatchMetadataRequest,
    _auth: None = Depends(_verify_ingest_key),
    db: SupabaseService = Depends(_get_db),
) -> PatchMetadataResponse:
    if not slug.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "slug must not be empty.")

    # Build the patch dict — only include fields that were explicitly supplied
    patch: dict[str, Any] = {}
    if body.volatility   is not None: patch["volatility"]   = body.volatility
    if body.version      is not None: patch["version"]      = body.version
    if body.last_updated is not None: patch["last_updated"] = body.last_updated
    if body.status       is not None: patch["status"]       = body.status

    if not patch:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No fields supplied. Provide at least one of: volatility, version, last_updated, status.",
        )

    try:
        updated = await db.update_chunks_metadata_by_slug(slug, patch)
    except Exception:
        logger.exception("Metadata patch failed for slug '%s'", slug)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to update metadata. Please try again later.")

    if updated == 0:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No chunks found for slug '{slug}'. Check the slug and try again.",
        )

    logger.info("Patched metadata for slug '%s': %s (%d chunk(s))", slug, patch, updated)
    return PatchMetadataResponse(slug=slug, updated_chunks=updated, patch=patch)


@router.delete(
    "/ingest/{slug}",
    response_model=DeleteResponse,
    summary="Delete all chunks for a given slug from the vector store.",
)
async def delete_by_slug(
    slug: str,
    _auth: None = Depends(_verify_ingest_key),
    db: SupabaseService = Depends(_get_db),
) -> DeleteResponse:
    if not slug.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "slug must not be empty.")

    try:
        deleted = await db.delete_chunks_by_slug(slug)
    except Exception:
        logger.exception("Failed to delete chunks for slug '%s'", slug)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to delete chunks. Please try again later.")

    logger.info("Deleted %d chunk(s) for slug '%s'.", deleted, slug)
    return DeleteResponse(slug=slug, deleted_chunks=deleted)
