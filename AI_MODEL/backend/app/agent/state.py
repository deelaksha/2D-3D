from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.state import ConversationState
from app.services import db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_conversation() -> ConversationState:
    conversation_id = f"conv_{uuid.uuid4().hex[:8]}"
    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO conversations (conversation_id, current_model_id, created_at, updated_at) "
            "VALUES (?, NULL, ?, ?)",
            (conversation_id, now, now),
        )
    return ConversationState(conversation_id=conversation_id)


def get_conversation(conversation_id: str) -> Optional[ConversationState]:
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM conversations WHERE conversation_id = ?", (conversation_id,)
        ).fetchone()
        if row is None:
            return None
        messages = conn.execute(
            "SELECT role, content, created_at FROM conversation_messages "
            "WHERE conversation_id = ? ORDER BY id",
            (conversation_id,),
        ).fetchall()

    return ConversationState(
        conversation_id=conversation_id,
        current_model_id=row["current_model_id"],
        messages=[{"role": m["role"], "content": m["content"], "created_at": m["created_at"]} for m in messages],
    )


def get_or_create_conversation(conversation_id: Optional[str]) -> ConversationState:
    if conversation_id:
        existing = get_conversation(conversation_id)
        if existing:
            return existing
    return create_conversation()


def add_message(conversation_id: str, role: str, content: str) -> None:
    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            "INSERT INTO conversation_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (conversation_id, role, content, now),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE conversation_id = ?", (now, conversation_id))


def set_current_model(conversation_id: str, model_id: str) -> None:
    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE conversations SET current_model_id = ?, updated_at = ? WHERE conversation_id = ?",
            (model_id, now, conversation_id),
        )
