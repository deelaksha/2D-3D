from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Complexity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ThreeDSpecification(BaseModel):
    """Structured intermediate representation between the LLM and the tool
    layer. The LLM never issues tool commands directly -- it produces one of
    these, which is validated before anything is built."""

    object: str = Field(..., min_length=1)
    style: str = "generic"
    materials: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    parts: list[str] = Field(default_factory=list)
    complexity: Complexity = Complexity.medium

    @field_validator("object")
    @classmethod
    def object_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("object must not be blank")
        return value


class ToolName(str, Enum):
    """The closed set of tools the LLM is allowed to invoke. Anything else
    fails pydantic validation before it ever reaches execution -- this is
    the enforcement point for Rule 3 ('LLM may ONLY invoke explicitly
    registered application tools')."""

    generate_3d = "generate_3d"
    edit_model = "edit_model"
    validate_model = "validate_model"
    optimize_model = "optimize_model"
    export_model = "export_model"


class ToolCall(BaseModel):
    tool: ToolName
    arguments: dict = Field(default_factory=dict)


class AgentPlan(BaseModel):
    steps: list[ToolCall] = Field(default_factory=list)
    reasoning: Optional[str] = None


class GenerateResult(BaseModel):
    success: bool
    model_id: str
    status: str
    file_path: str


class EditResult(BaseModel):
    success: bool
    model_id: str
    version: int
    changes: dict


class ValidateResult(BaseModel):
    valid: bool
    polygon_count: int
    has_texture: bool
    has_normals: bool
    errors: list[str] = Field(default_factory=list)


class OptimizeResult(BaseModel):
    success: bool
    model_id: str
    version: int
    operations: list[str]
    polygon_count_before: int
    polygon_count_after: int


class ExportResult(BaseModel):
    success: bool
    model_id: str
    format: str
    file_path: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    model_id: Optional[str] = None
    tool_calls: list[ToolCall] = Field(default_factory=list)


class ModelCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class EditModelRequest(BaseModel):
    changes: dict = Field(default_factory=dict)


class OptimizeModelRequest(BaseModel):
    operations: list[str] = Field(default_factory=lambda: ["make_game_ready"])


class ExportModelRequest(BaseModel):
    format: str = "glb"


class ModelOut(BaseModel):
    model_id: str
    version: int
    object: str
    style: str
    materials: list[str]
    colors: list[str]
    parts: list[str]
    complexity: Complexity
    status: str
    file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
