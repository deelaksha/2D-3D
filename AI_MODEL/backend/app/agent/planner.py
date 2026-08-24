from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import ValidationError

from app.llm.client import LLMClient, LLMError
from app.llm.prompts import (
    PLAN_SYSTEM_PROMPT,
    SPEC_EXTRACTION_SYSTEM_PROMPT,
    build_plan_prompt,
    build_repair_prompt,
    build_spec_prompt,
)
from app.models.schemas import AgentPlan, ThreeDSpecification

MAX_REPAIR_ATTEMPTS = 2


class PlanningError(Exception):
    """Raised when the LLM cannot produce output that validates against our
    schema, even after repair attempts (Phase 4's 'fail gracefully')."""


def _extract_json(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence:
        return fence.group(1)
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    if brace:
        return brace.group(0)
    return text


def extract_specification(llm: LLMClient, user_message: str) -> ThreeDSpecification:
    """Turn free-form user text into a validated ThreeDSpecification.
    Detects invalid LLM output, retries with a repair prompt, validates
    again, and fails gracefully (PlanningError) if still invalid."""

    prompt = build_spec_prompt(user_message)
    last_output = ""
    last_error = ""

    for attempt in range(MAX_REPAIR_ATTEMPTS + 1):
        try:
            response = llm.generate(
                build_repair_prompt(user_message, last_output, last_error) if attempt else prompt,
                system=SPEC_EXTRACTION_SYSTEM_PROMPT,
                format="json",
            )
        except LLMError as exc:
            raise PlanningError(f"LLM unavailable while extracting specification: {exc}") from exc

        last_output = response.text
        try:
            data = json.loads(_extract_json(response.text))
            return ThreeDSpecification.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            continue

    raise PlanningError(
        f"could not obtain a valid 3D specification after {MAX_REPAIR_ATTEMPTS + 1} attempts: {last_error}"
    )


def build_plan(llm: LLMClient, user_message: str, current_model_id: Optional[str]) -> AgentPlan:
    """Turn free-form user text into a validated AgentPlan of registered
    tool calls only. AgentPlan/ToolCall enforce the closed tool whitelist
    (see models/schemas.ToolName) -- invalid tool names never validate,
    so the LLM cannot smuggle in unregistered actions (Phase 12)."""

    prompt = build_plan_prompt(user_message, current_model_id is not None, current_model_id)
    last_output = ""
    last_error = ""

    for attempt in range(MAX_REPAIR_ATTEMPTS + 1):
        try:
            response = llm.generate(
                build_repair_prompt(user_message, last_output, last_error) if attempt else prompt,
                system=PLAN_SYSTEM_PROMPT,
                format="json",
            )
        except LLMError as exc:
            raise PlanningError(f"LLM unavailable while planning: {exc}") from exc

        last_output = response.text
        try:
            data = json.loads(_extract_json(response.text))
            return AgentPlan.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            continue

    raise PlanningError(f"could not obtain a valid plan after {MAX_REPAIR_ATTEMPTS + 1} attempts: {last_error}")
