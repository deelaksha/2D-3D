from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent import state as conv_state

router = APIRouter()


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict:
    convo = conv_state.get_conversation(conversation_id)
    if convo is None:
        raise HTTPException(status_code=404, detail=f"conversation not found: {conversation_id}")
    return {
        "conversation_id": convo.conversation_id,
        "current_model_id": convo.current_model_id,
        "messages": convo.messages,
    }
