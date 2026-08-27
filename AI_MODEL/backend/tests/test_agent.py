from __future__ import annotations

import json

import app.agent.agent as agent_module
from app.agent.agent import handle_message
from app.llm.client import LLMResponse


class _ScriptedLLM:
    """A fake LLM that returns pre-scripted responses in order, so agent
    tests never need a real Ollama daemon running."""

    def __init__(self, script):
        self._script = list(script)

    def generate(self, prompt, system=None, format=None):
        text = self._script.pop(0)
        return LLMResponse(text=text, model="scripted", raw={})

    def generate_vision(self, prompt, image_base64, system=None):
        return LLMResponse(
            text="[Qwen2.5-VL Reading]: Detected red wooden armchair with curved legs",
            model="qwen2.5vl:7b",
            raw={},
        )

    def is_available(self):
        return True


def test_generate_flow_creates_model(monkeypatch):
    plan = json.dumps({"steps": [{"tool": "generate_3d", "arguments": {}}], "reasoning": "new model"})
    spec = json.dumps(
        {
            "object": "gaming chair",
            "style": "futuristic",
            "materials": ["leather", "metal"],
            "colors": ["black", "red"],
            "parts": ["seat", "backrest"],
            "complexity": "medium",
        }
    )
    summary = "Created your futuristic gaming chair."
    monkeypatch.setattr(agent_module, "get_llm_client", lambda: _ScriptedLLM([plan, spec, summary]))

    response = handle_message("Create a futuristic gaming chair")

    assert response.model_id is not None
    assert response.model_id.startswith("model_")
    assert response.reply == summary


def test_edit_flow_requires_existing_model(monkeypatch):
    plan = json.dumps({"steps": [{"tool": "edit_model", "arguments": {"changes": {"width": "+20%"}}}]})
    summary = "I couldn't edit a model because none exists yet."
    monkeypatch.setattr(agent_module, "get_llm_client", lambda: _ScriptedLLM([plan, summary]))

    response = handle_message("Make it wider")

    assert response.model_id is None
    assert response.reply == summary


def test_multi_step_workflow_generates_optimizes_validates_exports(monkeypatch):
    plan = json.dumps(
        {
            "steps": [
                {"tool": "generate_3d", "arguments": {}},
                {"tool": "optimize_model", "arguments": {"operations": ["make_game_ready"]}},
                {"tool": "validate_model", "arguments": {}},
                {"tool": "export_model", "arguments": {"format": "glb"}},
            ]
        }
    )
    spec = json.dumps(
        {
            "object": "wooden table",
            "style": "low-poly",
            "materials": ["wood"],
            "colors": [],
            "parts": ["top", "legs"],
            "complexity": "low",
        }
    )
    summary = "Created, optimized, validated, and exported the wooden table."
    monkeypatch.setattr(agent_module, "get_llm_client", lambda: _ScriptedLLM([plan, spec, summary]))

    response = handle_message("Create a low-poly wooden table and make it game-ready")

    assert response.model_id is not None
    assert len(response.tool_calls) == 4
    assert response.reply == summary


def test_plan_rejects_unregistered_tool_and_fails_gracefully(monkeypatch):
    bad_plan = json.dumps({"steps": [{"tool": "run_shell_command", "arguments": {"cmd": "rm -rf /"}}]})
    monkeypatch.setattr(agent_module, "get_llm_client", lambda: _ScriptedLLM([bad_plan, bad_plan, bad_plan]))

    response = handle_message("do something dangerous")

    assert "couldn't understand" in response.reply.lower()
    assert response.tool_calls == []


def test_vision_image_processing_flow(monkeypatch):
    plan = json.dumps({"steps": [{"tool": "generate_3d", "arguments": {}}], "reasoning": "generate from image visual analysis"})
    spec = json.dumps(
        {
            "object": "armchair",
            "style": "curved",
            "materials": ["wood"],
            "colors": ["red"],
            "parts": ["seat", "backrest", "legs"],
            "complexity": "medium",
        }
    )
    summary = "Generated 3D armchair model from Qwen2.5-VL image analysis."
    monkeypatch.setattr(agent_module, "get_llm_client", lambda: _ScriptedLLM([plan, spec, summary]))

    fake_image_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    response = handle_message("Build this 3D model", image_base64=fake_image_b64)

    assert response.vision_analysis is not None
    assert "Qwen2.5-VL" in response.vision_analysis
    assert response.model_id is not None
    assert response.reply == summary
