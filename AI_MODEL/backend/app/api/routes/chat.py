from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.agent import handle_message
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """No business logic lives here -- this delegates straight to the
    agent (Phase 14)."""
    try:
        return handle_message(request.message, request.conversation_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"agent failed to process message: {exc}") from exc
