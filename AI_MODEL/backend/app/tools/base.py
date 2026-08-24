from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.models.schemas import ThreeDSpecification


class ThreeDGenerator(ABC):
    """Interface for turning a structured specification into a 3D asset.

    MockThreeDGenerator implements this today. A future RealThreeDGenerator
    (backed by a local 3D-generation AI model) implements the exact same
    interface -- callers (model_service, the agent) never change."""

    @abstractmethod
    def generate(self, spec: ThreeDSpecification, model_id: str) -> dict[str, Any]:
        ...


class MeshEditor(ABC):
    @abstractmethod
    def edit(self, model_id: str, version: int, changes: dict[str, Any]) -> dict[str, Any]:
        ...


class ModelValidator(ABC):
    @abstractmethod
    def validate(self, model_id: str, file_path: str) -> dict[str, Any]:
        ...


class ModelOptimizer(ABC):
    @abstractmethod
    def optimize(self, model_id: str, version: int, operations: list[str]) -> dict[str, Any]:
        ...


class ModelExporter(ABC):
    @abstractmethod
    def export(self, model_id: str, file_path: str, format: str) -> dict[str, Any]:
        ...
