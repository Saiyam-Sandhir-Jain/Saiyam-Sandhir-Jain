"""
routers/query.py
────────────────
POST /api/query
  • Pre-screens input for prompt injection patterns.
  • Embeds the sanitised query.
  • Runs cosine similarity search against Saiyam's knowledge base.
  • Passes retrieved context + question to Sams (Gemini RAG agent).
  • Returns the generated answer alongside source chunks.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status

from config import Settings, get_settings
from schemas import QueryRequest, QueryResponse, RetrievedChunk
from services.gemini import GeminiService
from services.supabase_db import SupabaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Sams — Portfolio RAG"])


def _get_gemini(settings: Settings = Depends(get_settings)) -> GeminiService:
    return GeminiService(settings)


# ── Prompt injection pre-filter ───────────────────────────────────────────────

# Patterns that are characteristic of jailbreak / prompt injection attempts.
# Checked case-insensitively against the raw user input BEFORE it reaches Gemini.
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
        r"forget\s+(your\s+)?(rules|instructions|system\s+prompt|guidelines)",
        r"you\s+are\s+now\s+",
        r"act\s+as\s+(if\s+you\s+are\s+|a\s+)?(?!saiyam|sams)",  # "act as X" where X is not saiyam/sams
        r"pretend\s+(you\s+)?(have\s+no|are\s+not|don't\s+have)",
        r"new\s+persona",
        r"jailbreak",
        r"dan\s+mode",
        r"developer\s+mode",
        r"override\s+(your\s+)?(system|rules|instructions)",
        r"disregard\s+(your\s+)?(previous|prior|all)",
        r"you\s+have\s+no\s+(rules|restrictions|limits)",
        r"your\s+(true|real)\s+(self|identity|purpose)",
        r"system\s*:\s",          # attempts to inject a new system turn
        r"\[system\]",
        r"<\s*system\s*>",
        r"reveal\s+(your\s+)?(system\s+prompt|instructions|prompt)",
        r"print\s+(your\s+)?(system\s+prompt|instructions)",
        r"what\s+(are|were)\s+your\s+(exact\s+)?instructions",
    ]
]

_SAFE_FALLBACK = (
    "I'm Sams, and I'm here to help you learn about Saiyam Sandhir Jain. "
    "Is there something about his skills, projects, or experience I can help with?"
)


def _is_injection_attempt(text: str) -> bool:
    """Return True if the input matches any known injection pattern."""
    return any(pattern.search(text) for pattern in _INJECTION_PATTERNS)


def _sanitize_input(text: str) -> str:
    """
    Light sanitization pass:
    - Collapse excessive whitespace / newlines that can be used to push
      system instructions off-screen in some interfaces.
    - Strip leading/trailing whitespace.
    Does NOT modify the semantic content of legitimate questions.
    """
    # Collapse runs of 3+ newlines into two (preserve intentional paragraph breaks)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse runs of 4+ spaces into one
    text = re.sub(r" {4,}", " ", text)
    return text.strip()


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/query",
    response_model=QueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Sams a question about Saiyam Sandhir Jain.",
)
async def sams_query(
    payload: QueryRequest,
    settings: Settings = Depends(get_settings),
    gemini: GeminiService = Depends(_get_gemini),
) -> QueryResponse:
    from main import get_supabase_service  # noqa: PLC0415

    # ── 1. Pre-screen for prompt injection ────────────────────────────────────
    if _is_injection_attempt(payload.query):
        logger.warning("Prompt injection attempt detected: %s", payload.query[:120])
        return QueryResponse(
            query=payload.query,
            answer=_SAFE_FALLBACK,
            retrieved_chunks=[],
            model_used=settings.gemini_chat_model,
            chunks_retrieved=0,
            injection_blocked=True,
        )

    # ── 2. Sanitize input ─────────────────────────────────────────────────────
    clean_query = _sanitize_input(payload.query)

    # ── 3. Embed the query ────────────────────────────────────────────────────
    # FIX: Do not surface raw exception messages to the client.
    try:
        query_embedding = await gemini.embed_query(clean_query)
    except Exception:
        logger.exception("Query embedding failed for query: %s", clean_query[:80])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to process your query. Please try again later.",
        )

    # ── 4. Retrieve similar chunks from Saiyam's knowledge base ──────────────
    db: SupabaseService = await get_supabase_service()
    try:
        chunks: list[RetrievedChunk] = await db.similarity_search(
            query_embedding=query_embedding,
            match_threshold=payload.match_threshold,
            match_count=payload.match_count,
        )
    except Exception:
        logger.exception("Vector similarity search failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to search the knowledge base. Please try again later.",
        )

    # ── 5. Handle no results ──────────────────────────────────────────────────
    if not chunks:
        return QueryResponse(
            query=clean_query,
            answer=(
                "I don't have specific information about that in my knowledge base right now. "
                "You're welcome to reach out to Saiyam directly — check the contact section!"
            ),
            retrieved_chunks=[],
            model_used=settings.gemini_chat_model,
            chunks_retrieved=0,
            injection_blocked=False,
        )

    # ── 6. Generate Sams' answer ──────────────────────────────────────────────
    context_dicts = [
        {"content": c.content, "metadata": c.metadata, "similarity": c.similarity}
        for c in chunks
    ]

    try:
        answer = await gemini.generate_answer(query=clean_query, context_chunks=context_dicts)
    except Exception:
        logger.exception("Answer generation failed for query: %s", clean_query[:80])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate an answer. Please try again later.",
        )

    return QueryResponse(
        query=clean_query,
        answer=answer,
        retrieved_chunks=chunks,
        model_used=settings.gemini_chat_model,
        chunks_retrieved=len(chunks),
        injection_blocked=False,
    )
