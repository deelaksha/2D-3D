from __future__ import annotations

import math

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.geometry import Vec3


class Camera(BaseModel):
    """Exact camera parameters used for one rendered view (prompt.txt #19)."""

    model_config = ConfigDict(frozen=True)

    view_name: str
    position: Vec3
    look_at: Vec3
    up: Vec3 = Vec3(x=0.0, y=0.0, z=1.0)
    fov_degrees: float
    near: float
    far: float
    resolution: tuple[int, int]

    @field_validator("fov_degrees")
    @classmethod
    def _fov_range(cls, v: float) -> float:
        if not (0 < v < 180):
            raise ValueError(f"fov_degrees must be in (0, 180), got {v}")
        return v

    @field_validator("near", "far")
    @classmethod
    def _positive_finite(cls, v: float) -> float:
        if not math.isfinite(v) or v <= 0:
            raise ValueError(f"near/far must be finite and > 0, got {v}")
        return v

    @field_validator("resolution")
    @classmethod
    def _positive_resolution(cls, v: tuple[int, int]) -> tuple[int, int]:
        if v[0] <= 0 or v[1] <= 0:
            raise ValueError(f"resolution must be positive, got {v}")
        return v
