"""
routers/ingest.py
─────────────────
POST /api/ingest
  • Requires X-API-Key header matching INGEST_API_KEY in env.
  • Accepts any supported file type (see _ALL_SUPPORTED below).
  • Extracts text from the file using the appropriate strategy per type.
  • Splits the extracted text into overlapping chunks.
  • Generates embeddings via Gemini (gemini-embedding-2).
  • Stores chunks + embeddings in Supabase.

Supported file types
─────────────────────
  Plain text : .txt  .md  .markdown  .csv  .tsv  .log  .yaml  .yml  .json
               .html  .htm  .rst  .xml
  Documents  : .pdf  .docx
  Images     : .jpg  .jpeg  .png  .webp  .gif
               (Gemini vision extracts all text and visual content)
"""

from __future__ import annotations

import io
import logging
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, status

from config import Settings, get_settings
from schemas import ChunkRecord, IngestResponse
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


# ── Text extraction ───────────────────────────────────────────────────────────

async def _extract_text(
    raw_bytes: bytes,
    filename: str,
    gemini: GeminiService,
) -> str:
    """
    Dispatch to the appropriate extraction strategy based on file extension.
    Returns a UTF-8 string ready for chunking.
    """
    ext = Path(filename).suffix.lower()

    # ── Plain text ────────────────────────────────────────────────────────────
    if ext in _TEXT_EXTENSIONS:
        return raw_bytes.decode("utf-8", errors="replace")

    # ── PDF ───────────────────────────────────────────────────────────────────
    if ext in _PDF_EXTENSIONS:
        try:
            import pypdf  # lazy import — only needed for PDF files
        except ImportError as exc:
            raise RuntimeError(
                "pypdf is required to process PDF files. "
                "Install it with: pip install pypdf"
            ) from exc

        reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
        pages: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages.append(page_text)

        text = "\n\n".join(pages)
        if not text.strip():
            raise ValueError(
                "No extractable text found in this PDF. "
                "Scanned or image-only PDFs are not currently supported via this path."
            )
        return text

    # ── DOCX ──────────────────────────────────────────────────────────────────
    if ext in _DOCX_EXTENSIONS:
        try:
            import docx  # python-docx — lazy import
        except ImportError as exc:
            raise RuntimeError(
                "python-docx is required to process .docx files. "
                "Install it with: pip install python-docx"
            ) from exc

        doc = docx.Document(io.BytesIO(raw_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n\n".join(paragraphs)
        if not text.strip():
            raise ValueError("No extractable text found in this .docx file.")
        return text

    # ── Images (Gemini vision) ────────────────────────────────────────────────
    if ext in _IMAGE_EXTENSIONS:
        mime_type = _IMAGE_MIME[ext]
        logger.info("Describing image '%s' (%s) via Gemini vision…", filename, mime_type)
        description = await gemini.describe_image(raw_bytes, mime_type)
        if not description.strip():
            raise ValueError("Gemini vision returned no content for this image.")
        # Prefix so the source type is clear in retrieved context
        return f"[Image: {filename}]\n\n{description}"

    # Should never reach here given earlier validation, but guard anyway.
    raise ValueError(f"Unsupported file extension: {ext!r}")


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
    summary="Upload and ingest a document or image into the vector store.",
    description=(
        "Accepts plain text (.txt, .md, .csv, …), PDFs, Word documents (.docx), "
        "and images (.jpg, .png, .webp, .gif). "
        "Images are described by Gemini vision before chunking. "
        "Requires X-API-Key authentication."
    ),
)
async def ingest_document(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
    gemini: GeminiService = Depends(_get_gemini),
    _auth: None = Depends(_verify_ingest_key),   # require API key
) -> IngestResponse:
    # ── Validate file type ────────────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file has no filename.",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in _ALL_SUPPORTED:
        supported_list = ", ".join(sorted(_ALL_SUPPORTED))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type: {ext!r}. "
                f"Supported extensions: {supported_list}"
            ),
        )

    # ── Read file with size guard ─────────────────────────────────────────────
    # Read one byte beyond the limit so we can detect oversized uploads
    # without loading the entire file into memory first.
    try:
        raw_bytes = await file.read(settings.max_upload_bytes + 1)
    except Exception:
        logger.exception("Failed to read uploaded file '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded file.",
        )
    finally:
        await file.close()

    # Enforce upload size limit.
    if len(raw_bytes) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {limit_mb} MB.",
        )

    # ── Extract text ──────────────────────────────────────────────────────────
    try:
        text = await _extract_text(raw_bytes, file.filename, gemini)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except RuntimeError as exc:
        logger.error("Extraction dependency missing for '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Text extraction failed for '%s'", file.filename)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract text from the uploaded file.",
        )

    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text could be extracted from the uploaded file.",
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
    # Do not surface raw exception messages to the client.
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
                "file_type": ext.lstrip("."),
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
