from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.llm.client import get_llm_client

router = APIRouter()


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    try:
        llm_available = get_llm_client().is_available()
    except Exception:
        llm_available = False

    return {
        "status": "healthy",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_available": llm_available,
        "threed_provider": settings.threed_provider,
    }
