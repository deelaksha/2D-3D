from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.llm.client import get_active_provider, get_llm_client, set_provider_override

logger = logging.getLogger("app.api.health")
router = APIRouter()


class AwakenRequest(BaseModel):
    model: Optional[str] = None
    keep_alive: str = "60m"


class ModeRequest(BaseModel):
    provider: str  # "ollama" or "mock"


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    provider = get_active_provider()
    llm_available = False
    llm_awake = False

    try:
        client = get_llm_client()
        llm_available = client.is_available()
        llm_awake = client.is_awake()
    except Exception as exc:
        logger.warning("Error checking LLM status: %s", exc)

    return {
        "status": "healthy",
        "llm_provider": provider,
        "llm_model": settings.llm_model,
        "llm_vision_model": settings.llm_vision_model,
        "llm_available": llm_available,
        "llm_awake": llm_awake,
        "threed_provider": settings.threed_provider,
    }


@router.post("/ai/awaken")
@router.get("/ai/awaken")
def awaken_model(req: Optional[AwakenRequest] = None) -> dict:
    """Pre-warm/preload the local AI model into GPU/RAM with keep_alive to avoid cold-start delays."""
    model_name = req.model if req and req.model else None
    keep_alive = req.keep_alive if req and req.keep_alive else "60m"
    try:
        client = get_llm_client()
        res = client.awaken(model=model_name, keep_alive=keep_alive)
        is_awake = client.is_awake(model=model_name)
        return {
            "success": res.get("success", True),
            "status": "awake" if is_awake else "loading",
            "model": res.get("model", model_name or "default"),
            "is_awake": is_awake,
            "details": res,
        }
    except Exception as exc:
        logger.error("Error awakening model: %s", exc)
        return {
            "success": False,
            "status": "error",
            "error": str(exc),
            "is_awake": False,
        }


@router.post("/ai/mode")
def set_mode(req: ModeRequest) -> dict:
    """Switch runtime LLM provider dynamically between 'ollama' and 'mock'."""
    try:
        set_provider_override(req.provider)
        client = get_llm_client()
        return {
            "success": True,
            "active_provider": get_active_provider(),
            "llm_available": client.is_available(),
            "llm_awake": client.is_awake(),
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}
