"""Material metadata (prompt.txt #10). Never part of a component's primary
type/subtype identity -- always an optional attribute alongside it."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.taxonomy import MATERIALS


class Material(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    color_rgb: tuple[float, float, float] | None = None
    """Base color override (0-1 linear RGB) used by the renderer. If unset,
    the renderer looks up a default color for `name` (generators/house/materials.py)."""

    @field_validator("name")
    @classmethod
    def _known_material(cls, v: str) -> str:
        if v not in MATERIALS:
            raise ValueError(f"unknown material {v!r}, expected one of {sorted(MATERIALS)}")
        return v

    @field_validator("color_rgb")
    @classmethod
    def _color_range(cls, v: tuple[float, float, float] | None):
        if v is None:
            return v
        for c in v:
            if not (0.0 <= c <= 1.0):
                raise ValueError(f"color_rgb channels must be in [0,1], got {v}")
        return v
