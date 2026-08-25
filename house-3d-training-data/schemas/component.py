from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from schemas.geometry import Anchor, BoundingBox, Dimensions, Transform
from schemas.material import Material
from schemas.taxonomy import (
    ALL_COMPONENT_TYPES,
    ALL_SUBTYPES,
    ANCHOR_NAMES,
    DOOR_SUBTYPES,
    WALL_SUBTYPES,
    WINDOW_SUBTYPES,
)

_SUBTYPES_BY_TYPE = {
    "wall": WALL_SUBTYPES,
    "door": DOOR_SUBTYPES,
    "window": WINDOW_SUBTYPES,
}


class MeshInfo(BaseModel):
    model_config = ConfigDict(frozen=True)

    vertex_count: int
    face_count: int
    formats: list[str]

    @field_validator("vertex_count", "face_count")
    @classmethod
    def _positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError(f"mesh must have > 0 elements, got {v}")
        return v


class Component(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    type: str
    subtype: str | None = None
    dimensions: Dimensions
    transform: Transform
    bounding_box: BoundingBox
    material: Material | None = None
    anchors: list[Anchor] = []
    mesh: MeshInfo

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        if v not in ALL_COMPONENT_TYPES:
            raise ValueError(f"unknown component type {v!r}")
        return v

    @model_validator(mode="after")
    def _subtype_matches_type(self) -> "Component":
        if self.subtype is None:
            return self
        if self.subtype not in ALL_SUBTYPES:
            raise ValueError(f"unknown subtype {self.subtype!r}")
        allowed = _SUBTYPES_BY_TYPE.get(self.type)
        if allowed is not None and self.subtype not in allowed:
            raise ValueError(
                f"subtype {self.subtype!r} is not valid for type {self.type!r} "
                f"(expected one of {sorted(allowed)})"
            )
        return self

    @model_validator(mode="after")
    def _anchor_names_known(self) -> "Component":
        allowed = ANCHOR_NAMES.get(self.type)
        if allowed is None:
            return self
        for anchor in self.anchors:
            if anchor.name not in allowed:
                raise ValueError(
                    f"anchor {anchor.name!r} is not valid for type {self.type!r} "
                    f"(expected one of {sorted(allowed)})"
                )
        return self
