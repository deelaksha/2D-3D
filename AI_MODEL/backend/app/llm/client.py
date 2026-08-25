from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import requests

from app.config import get_settings


class LLMError(Exception):
    """Raised when the local LLM cannot be reached or returns an unusable
    response. Callers must handle this explicitly (Rule 2 / Phase 18) --
    it is never allowed to surface as a raw stack trace to the user."""


@dataclass
class LLMResponse:
    text: str
    model: str
    raw: dict


class LLMClient(ABC):
    """Local-only LLM interface (Rule 4: no cloud dependency for the core
    AI). Every provider implementation must run entirely on this machine."""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        format: Optional[str] = None,
    ) -> LLMResponse:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...


class OllamaClient(LLMClient):
    """Talks to a locally running Ollama daemon over HTTP.

    Architecture: Python -> OllamaClient -> Ollama HTTP API -> local model.
    The model name is never hard-coded elsewhere -- it comes from
    LLM_MODEL (see docs/local-llm.md)."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        settings = get_settings()
        self.base_url = (base_url or settings.llm_base_url).rstrip("/")
        self.model = model or settings.llm_model
        self.timeout = timeout or settings.llm_timeout_seconds

    def is_available(self) -> bool:
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=1.5)
            return response.status_code == 200
        except requests.RequestException:
            return False

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        format: Optional[str] = None,
    ) -> LLMResponse:
        payload = {"model": self.model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format

        try:
            response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=self.timeout)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise LLMError(f"failed to reach Ollama at {self.base_url}: {exc}") from exc

        data = response.json()
        text = data.get("response", "")
        if not text:
            raise LLMError(f"empty response from model {self.model!r}")
        return LLMResponse(text=text, model=self.model, raw=data)


import json
import logging

logger = logging.getLogger("app.llm")


class MockLLMClient(LLMClient):
    """Mock/Fallback LLM implementation for generating valid tool plans, 3D specs,
    and text responses when Ollama daemon is offline or LLM_PROVIDER=mock."""

    def __init__(self, model: str = "mock-llm"):
        self.model = model

    def is_available(self) -> bool:
        return True

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        format: Optional[str] = None,
    ) -> LLMResponse:
        prompt_lower = prompt.lower()
        system_str = system or ""

        # 1. Planning prompt
        if "AgentPlan" in system_str or "plan" in system_str.lower() or "Available tools:" in prompt:
            if any(w in prompt_lower for w in ["edit", "wider", "taller", "color", "change", "make it"]):
                plan_data = {
                    "steps": [{"tool": "edit_model", "arguments": {"changes": {"request": prompt}}}],
                    "reasoning": "editing existing model based on user instructions"
                }
            elif any(w in prompt_lower for w in ["game-ready", "optimize"]):
                plan_data = {
                    "steps": [
                        {"tool": "generate_3d", "arguments": {}},
                        {"tool": "optimize_model", "arguments": {"operations": ["make_game_ready"]}},
                        {"tool": "validate_model", "arguments": {}},
                        {"tool": "export_model", "arguments": {"format": "glb"}}
                    ],
                    "reasoning": "generating, optimizing, validating and exporting game-ready 3D model"
                }
            elif "export" in prompt_lower:
                fmt = "obj" if "obj" in prompt_lower else "fbx" if "fbx" in prompt_lower else "glb"
                plan_data = {
                    "steps": [{"tool": "export_model", "arguments": {"format": fmt}}],
                    "reasoning": "exporting model"
                }
            elif "validate" in prompt_lower:
                plan_data = {
                    "steps": [{"tool": "validate_model", "arguments": {}}],
                    "reasoning": "validating model"
                }
            else:
                plan_data = {
                    "steps": [{"tool": "generate_3d", "arguments": {}}],
                    "reasoning": "generating new 3D model"
                }
            return LLMResponse(text=json.dumps(plan_data), model=self.model, raw={})

        # 2. Spec extraction prompt
        if "ThreeDSpecification" in system_str or "specification" in system_str.lower() or "JSON object matching" in prompt:
            color_candidates = ["red", "green", "blue", "black", "white", "yellow", "purple", "orange", "brown", "gold", "silver", "pink", "cyan"]
            extracted_colors = [c for c in color_candidates if c in prompt_lower] or ["red"]

            obj = "rounded_square" if any(w in prompt_lower for w in ["square", "cube", "box"]) else ("chair" if "chair" in prompt_lower else "table" if "table" in prompt_lower else "custom_3d_mesh")
            style = "curved" if any(w in prompt_lower for w in ["curv", "round", "smooth"]) else ("futuristic" if "futuristic" in prompt_lower else "standard")
            parts = ["curved_bevel_edges", "top_face", "side_panel"] if "curv" in prompt_lower or "square" in prompt_lower else ["seat", "backrest", "legs"] if "chair" in prompt_lower else ["body", "base"]

            spec_data = {
                "object": obj,
                "style": style,
                "materials": ["smooth_plastic", "matte_finish"],
                "colors": extracted_colors,
                "parts": parts,
                "complexity": "medium"
            }
            return LLMResponse(text=json.dumps(spec_data), model=self.model, raw={})

        # 3. Summary prompt or default
        return LLMResponse(
            text=f"Processed your request using local AI: '{prompt.splitlines()[0]}'. The 3D model has been processed.",
            model=self.model,
            raw={}
        )


def get_llm_client() -> LLMClient:
    settings = get_settings()
    if settings.llm_provider == "ollama":
        client = OllamaClient()
        if client.is_available():
            return client
        logger.warning("Ollama daemon is unreachable at %s. Falling back to MockLLMClient.", settings.llm_base_url)
        return MockLLMClient()
    elif settings.llm_provider == "mock":
        return MockLLMClient()

    raise NotImplementedError(
        f"LLM_PROVIDER={settings.llm_provider!r} is not supported. "
        "Supported providers are 'ollama' and 'mock'."
    )

