from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.quality import QualityScore

Split = Literal["train", "validation", "test", "rejected"]


class DatasetSample(BaseModel):
    """One line of datasets/<name>/metadata/index.jsonl (prompt.txt #29).
    All paths are relative to the dataset root -- never machine-specific
    absolute paths."""

    model_config = ConfigDict(frozen=True)

    id: str
    image: str
    mesh: str
    scene: str
    depth: str
    segmentation: str
    camera: str
    category: str
    split: Split
    quality: QualityScore | None = None

    @field_validator("image", "mesh", "scene", "depth", "segmentation", "camera")
    @classmethod
    def _relative_path(cls, v: str) -> str:
        if v.startswith("/"):
            raise ValueError(f"path must be relative, got absolute path {v!r}")
        return v
