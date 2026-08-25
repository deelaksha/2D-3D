"""Dimensions, transforms, bounding boxes, anchors -- strict validation.

Every float here is checked finite (no NaN/inf, prompt.txt #31/#32) and every
size is checked strictly positive (no zero-size geometry, prompt.txt #31).
"""

from __future__ import annotations

import math

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


def _finite(value: float, name: str) -> float:
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite, got {value!r}")
    return value


class Vec3(BaseModel):
    model_config = ConfigDict(frozen=True)

    x: float
    y: float
    z: float

    @field_validator("x", "y", "z")
    @classmethod
    def _check_finite(cls, v: float) -> float:
        return _finite(v, "Vec3 component")

    def as_tuple(self) -> tuple[float, float, float]:
        return (self.x, self.y, self.z)

    @classmethod
    def from_tuple(cls, t: tuple[float, float, float]) -> "Vec3":
        return cls(x=t[0], y=t[1], z=t[2])


class Dimensions(BaseModel):
    """Real-world size in meters. width=X, depth=Y, height=Z."""

    model_config = ConfigDict(frozen=True)

    width: float
    height: float
    depth: float

    @field_validator("width", "height", "depth")
    @classmethod
    def _positive_finite(cls, v: float) -> float:
        _finite(v, "dimension")
        if v <= 0:
            raise ValueError(f"dimension must be > 0 (zero-size geometry), got {v}")
        return v

    def volume(self) -> float:
        return self.width * self.height * self.depth


class Transform(BaseModel):
    """World transform. rotation is Euler XYZ degrees, applied X then Y then Z."""

    model_config = ConfigDict(frozen=True)

    position: Vec3
    rotation: Vec3 = Vec3(x=0.0, y=0.0, z=0.0)


class BoundingBox(BaseModel):
    model_config = ConfigDict(frozen=True)

    min: Vec3
    max: Vec3

    @model_validator(mode="after")
    def _min_le_max(self) -> "BoundingBox":
        if not (
            self.min.x <= self.max.x
            and self.min.y <= self.max.y
            and self.min.z <= self.max.z
        ):
            raise ValueError(f"bounding_box.min must be <= max, got {self.min} / {self.max}")
        return self

    def size(self) -> Vec3:
        return Vec3(
            x=self.max.x - self.min.x,
            y=self.max.y - self.min.y,
            z=self.max.z - self.min.z,
        )


class Anchor(BaseModel):
    """A named semantic point on a component, in world space (prompt.txt #25)."""

    model_config = ConfigDict(frozen=True)

    name: str
    position: Vec3
