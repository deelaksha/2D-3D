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
        return handle_message(
            user_message=request.message,
            conversation_id=request.conversation_id,
            image_base64=request.image_base64,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"agent failed to process message: {exc}") from exc
