from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class QualityScore(BaseModel):
    """Per-sample quality score (prompt.txt #46). Each field in [0, 1]."""

    model_config = ConfigDict(frozen=True)

    geometry_quality: float
    annotation_quality: float
    segmentation_quality: float
    physical_validity: float
    overall_quality: float | None = None
    """If not supplied, computed as the mean of the other four."""

    @field_validator(
        "geometry_quality",
        "annotation_quality",
        "segmentation_quality",
        "physical_validity",
        "overall_quality",
    )
    @classmethod
    def _unit_range(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"quality score must be in [0,1], got {v}")
        return v

    @model_validator(mode="after")
    def _fill_overall(self) -> "QualityScore":
        if self.overall_quality is None:
            mean = (
                self.geometry_quality
                + self.annotation_quality
                + self.segmentation_quality
                + self.physical_validity
            ) / 4.0
            object.__setattr__(self, "overall_quality", mean)
        return self
