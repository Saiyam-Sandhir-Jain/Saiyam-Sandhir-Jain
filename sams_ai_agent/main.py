"""
main.py
───────
FastAPI application entry-point.

Responsibilities:
  • Application lifespan (startup / shutdown) for shared resources.
  • Global error handlers.
  • CORS and logging middleware.
  • Router registration.
  • Dependency accessor for the SupabaseService singleton.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routers import ingest, query
from schemas import HealthResponse
from services.supabase_db import SupabaseService

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s – %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ── App state container ───────────────────────────────────────────────────────
# Stored as a module-level reference so routers can access it without
# threading a Request object through every function signature.
_supabase_service: SupabaseService | None = None


async def get_supabase_service() -> SupabaseService:
    """
    Return the SupabaseService singleton created during startup.
    Raises RuntimeError if called before the lifespan initialisation completes.
    """
    if _supabase_service is None:
        raise RuntimeError(
            "SupabaseService is not initialised. "
            "This usually means the app has not finished its startup lifespan."
        )
    return _supabase_service


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Runs once at startup (before) and once at shutdown (after yield).
    Initialises all shared, expensive resources here so they are not
    re-created on every request.
    """
    global _supabase_service

    settings = get_settings()
    logger.info("Starting RAG backend (chat_model=%s, embed_model=%s)",
                settings.gemini_chat_model, settings.gemini_embedding_model)

    # ── Startup ───────────────────────────────────────────────────────────────
    try:
        _supabase_service = await SupabaseService.create(settings)
        logger.info("All services initialised successfully. API is ready.")
    except Exception as exc:
        logger.critical("Startup failed: %s", exc, exc_info=True)
        raise

    yield  # ←─ app is alive and serving requests here ─→

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down – releasing resources.")
    _supabase_service = None


# ── Application ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = get_settings()

    # Disable interactive docs in production to avoid exposing the API schema.
    is_dev = settings.environment.lower() == "development"

    app = FastAPI(
        title="RAG Agent API",
        description=(
            "Production-ready Retrieval-Augmented Generation backend "
            "powered by Google Gemini and Supabase pgvector."
        ),
        version="1.0.0",
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url="/openapi.json" if is_dev else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    # FIX: allow_origins=["*"] is invalid when allow_credentials=True per the
    # CORS spec – browsers will refuse the response. Origins are now loaded
    # from the ALLOWED_ORIGINS env variable (comma-separated list).
    # FIX: Restrict methods and headers to only what the API actually uses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.parsed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    )

    # ── Global exception handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected internal error occurred. Please try again later."},
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(ingest.router)
    app.include_router(query.router)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["Health"],
        summary="Liveness probe – returns 200 when the service is up.",
    )
    async def health_check() -> HealthResponse:
        return HealthResponse()

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"message": "RAG Agent API is running."}

    logger.info(
        "App created | env=%s | origins=%s | embed_dims=%d | chunk=%d | overlap=%d | threshold=%.2f | top_k=%d",
        settings.environment,
        settings.parsed_origins,
        settings.embedding_dimensions,
        settings.chunk_size,
        settings.chunk_overlap,
        settings.match_threshold,
        settings.match_count,
    )
    return app


app = create_app()


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",   # FIX: bind to loopback only in dev; use a reverse proxy in prod
        port=8000,
        reload=True,        # disable in production
        log_level="info",
    )
