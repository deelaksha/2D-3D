from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import get_settings
from app.models.schemas import ThreeDSpecification
from app.tools.base import ThreeDGenerator
from app.tools.glb_utils import generate_procedural_glb, write_placeholder_glb


class MockThreeDGenerator(ThreeDGenerator):
    """Stand-in for a real local 3D-generation AI model (Phase 5 & 21).

    Produces spec-valid procedural GLB models so the rest of the
    pipeline (state, validation, optimization, export, viewer) can be built
    and tested without a real model. The rest of the application only ever
    sees the ThreeDGenerator interface, so swapping in a
    RealThreeDGenerator later requires no other code changes.
    """

    def generate(self, spec: ThreeDSpecification, model_id: str) -> dict[str, Any]:
        settings = get_settings()
        relative_path = Path(settings.outputs_dir) / model_id / "model.glb"
        absolute_path = settings.resolve(str(relative_path))
        generate_procedural_glb(spec, absolute_path)

        return {
            "success": True,
            "model_id": model_id,
            "status": "generated",
            "file_path": relative_path.as_posix(),
        }


def get_generator() -> ThreeDGenerator:
    settings = get_settings()
    if settings.threed_provider == "mock":
        return MockThreeDGenerator()
    raise NotImplementedError(
        f"THREED_PROVIDER={settings.threed_provider!r} is not implemented yet. "
        "Only 'mock' is available until Phase 21 (real model integration)."
    )
