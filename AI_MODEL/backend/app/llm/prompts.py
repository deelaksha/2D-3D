from __future__ import annotations

import json
from typing import Optional

SPEC_EXTRACTION_SYSTEM_PROMPT = """You convert a user's natural-language request for a 3D object into a strict JSON specification.

Output ONLY a single JSON object with exactly these keys:
- object (string): the thing being created, e.g. "gaming chair"
- style (string): e.g. "futuristic", "minimalist", "generic"
- materials (array of strings)
- colors (array of strings)
- parts (array of strings): the object's major components
- complexity ("low" | "medium" | "high")

No prose, no markdown fences, no explanation. JSON only."""


def build_spec_prompt(user_message: str) -> str:
    return f'User request: "{user_message}"\n\nJSON specification:'


def build_repair_prompt(user_message: str, bad_output: str, error: str) -> str:
    return (
        f'User request: "{user_message}"\n\n'
        f"Your previous output was invalid JSON or did not match the required schema.\n"
        f"Previous output:\n{bad_output}\n\n"
        f"Validation error:\n{error}\n\n"
        "Return corrected JSON only, following the schema exactly."
    )


PLAN_SYSTEM_PROMPT = """You are a planning module for a 3D-model-generation assistant.
Given a user message and the current session state, decide which registered tools to call.

You may ONLY use these tool names -- no others, no shell commands, no free-form actions:
- generate_3d: create a brand new model from a specification
- edit_model: modify an existing model (requires an existing model_id)
- validate_model: check an existing model
- optimize_model: optimize an existing model (e.g. reduce polygons, make game-ready)
- export_model: export an existing model to a file format (glb, obj, fbx)

Output ONLY a single JSON object:
{"steps": [{"tool": "<name>", "arguments": {...}}, ...], "reasoning": "<short reasoning>"}

If no model exists yet and the user asks to edit/optimize/export/validate, prefer generate_3d first.
Keep "steps" as short as possible -- only what the request actually needs."""


def build_plan_prompt(user_message: str, has_current_model: bool, current_model_id: Optional[str]) -> str:
    state_desc = (
        f"current_model_id={current_model_id}" if has_current_model else "no current model in this conversation"
    )
    return f'Session state: {state_desc}\nUser message: "{user_message}"\n\nJSON plan:'


SUMMARY_SYSTEM_PROMPT = """You write a short, friendly summary of what just happened for the user,
based on tool results from a 3D-model-generation assistant. Do not invent facts not present in the results."""


def build_summary_prompt(user_message: str, tool_results: list[dict]) -> str:
    return (
        f'User asked: "{user_message}"\n\n'
        f"Tool results:\n{json.dumps(tool_results, indent=2)}\n\n"
        "Write a 1-3 sentence reply summarizing what was done."
    )
