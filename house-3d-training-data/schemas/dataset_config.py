from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, model_validator


class DatasetInfo(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    category: str
    version: str


class PathsConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    root: str


class SplitConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    train: float
    validation: float
    test: float

    @model_validator(mode="after")
    def _sums_to_one(self) -> "SplitConfig":
        total = self.train + self.validation + self.test
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"train+validation+test must sum to 1.0, got {total}")
        return self


class GenerationConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    seed: int | None = None
    resolution: tuple[int, int]
    image_format: str = "png"
    mesh_formats: list[str] = ["glb", "obj"]
    views: list[str]
    supersample: int = 2
    light_direction: tuple[float, float, float] = (-0.4, -0.6, -0.7)
    ambient: float = 0.35
    fov_degrees: float = 50.0
    near: float = 0.05
    far: float = 100.0


class QualityConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    min_overall_quality: float


class DatasetYamlConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    dataset: DatasetInfo
    paths: PathsConfig
    split: SplitConfig
    generation: GenerationConfig
    quality: QualityConfig
    component_priority: dict[str, float] = {}

    @classmethod
    def load(cls, path: str | Path) -> "DatasetYamlConfig":
        with open(path) as f:
            raw = yaml.safe_load(f)
        return cls.model_validate(raw)
