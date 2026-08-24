from __future__ import annotations

from typing import Any

from app.config import get_settings
from app.tools.base import ModelValidator
from app.tools.glb_utils import estimate_polygon_count


class MockModelValidator(ModelValidator):
    """Mock validator for Phase 8. Returns simulated mesh-validation info.
    Real geometry checks (topology, UVs, normals, textures) can later
    replace this behind the same ModelValidator interface."""

    def validate(self, model_id: str, file_path: str) -> dict[str, Any]:
        settings = get_settings()
        errors: list[str] = []

        if not file_path:
            errors.append("model has no associated file")
        else:
            absolute_path = settings.resolve(file_path)
            if not absolute_path.exists():
                errors.append(f"file not found: {file_path}")

        return {
            "valid": len(errors) == 0,
            "polygon_count": estimate_polygon_count("medium"),
            "has_texture": True,
            "has_normals": True,
            "errors": errors,
        }


def get_validator() -> ModelValidator:
    return MockModelValidator()
