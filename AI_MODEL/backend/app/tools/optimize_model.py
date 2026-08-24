from __future__ import annotations

from typing import Any

from app.tools.base import ModelOptimizer
from app.tools.glb_utils import estimate_polygon_count

_KNOWN_OPERATIONS = {"reduce_polygons", "make_game_ready", "optimize_textures"}


class MockModelOptimizer(ModelOptimizer):
    """Mock optimizer for Phase 9. Updates metadata/state only -- unknown
    operations are ignored rather than applied. A real Blender/mesh
    pipeline will later perform the actual work behind this same
    ModelOptimizer interface."""

    def optimize(self, model_id: str, version: int, operations: list[str]) -> dict[str, Any]:
        applied = [op for op in operations if op in _KNOWN_OPERATIONS]
        before = estimate_polygon_count("medium")
        after = before
        if "reduce_polygons" in applied or "make_game_ready" in applied:
            after = max(int(before * 0.3), 500)

        return {
            "success": True,
            "model_id": model_id,
            "version": version + 1,
            "operations": applied,
            "polygon_count_before": before,
            "polygon_count_after": after,
        }


def get_optimizer() -> ModelOptimizer:
    return MockModelOptimizer()
