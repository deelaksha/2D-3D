from __future__ import annotations

from typing import Any

from app.tools.base import MeshEditor


class MockMeshEditor(MeshEditor):
    """Mock editor for Phase 6. Rather than performing real mesh edits, it
    updates model metadata/state and bumps the version. A real mesh-editing
    backend can later replace this behind the same MeshEditor interface."""

    def edit(self, model_id: str, version: int, changes: dict[str, Any]) -> dict[str, Any]:
        return {
            "success": True,
            "model_id": model_id,
            "version": version + 1,
            "changes": changes,
        }


def get_editor() -> MeshEditor:
    return MockMeshEditor()
