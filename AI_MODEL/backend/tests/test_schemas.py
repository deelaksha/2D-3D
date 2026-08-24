from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.schemas import AgentPlan, ThreeDSpecification, ToolCall, ToolName


def test_valid_specification_parses():
    spec = ThreeDSpecification(
        object="gaming chair",
        style="futuristic",
        materials=["leather", "metal"],
        colors=["black", "red"],
        parts=["seat", "backrest", "armrests", "metal legs"],
        complexity="medium",
    )
    assert spec.object == "gaming chair"
    assert spec.complexity.value == "medium"


def test_specification_defaults_apply():
    spec = ThreeDSpecification(object="table")
    assert spec.style == "generic"
    assert spec.materials == []
    assert spec.complexity.value == "medium"


def test_blank_object_rejected():
    with pytest.raises(ValidationError):
        ThreeDSpecification(object="   ")


def test_invalid_complexity_rejected():
    with pytest.raises(ValidationError):
        ThreeDSpecification(object="chair", complexity="ultra")


def test_tool_call_rejects_unregistered_tool():
    with pytest.raises(ValidationError):
        ToolCall(tool="run_shell_command", arguments={})


def test_agent_plan_parses_multiple_steps():
    plan = AgentPlan.model_validate(
        {
            "steps": [
                {"tool": "generate_3d", "arguments": {}},
                {"tool": "optimize_model", "arguments": {"operations": ["make_game_ready"]}},
                {"tool": "validate_model", "arguments": {}},
            ]
        }
    )
    assert [s.tool for s in plan.steps] == [
        ToolName.generate_3d,
        ToolName.optimize_model,
        ToolName.validate_model,
    ]
