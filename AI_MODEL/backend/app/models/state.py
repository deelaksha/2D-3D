from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ModelRecord:
    """Internal representation of a model's persisted state (Phase 7).
    services.model_service converts SQLite rows into these; API routes
    convert these into ModelOut for the wire."""

    model_id: str
    version: int
    object: str
    style: str
    materials: list[str]
    colors: list[str]
    parts: list[str]
    complexity: str
    status: str
    file_path: Optional[str] = None
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)


@dataclass
class ConversationState:
    """In-memory view of a conversation's persisted state (Phase 13):
    conversation id, current model, and message history."""

    conversation_id: str
    current_model_id: Optional[str] = None
    messages: list[dict] = field(default_factory=list)
