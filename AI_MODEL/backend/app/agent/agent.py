from __future__ import annotations

from typing import Any, Optional

from app.agent import state as conv_state
from app.agent.planner import PlanningError, build_plan, extract_specification
from app.llm.client import LLMClient, LLMError, get_llm_client
from app.llm.prompts import SUMMARY_SYSTEM_PROMPT, build_summary_prompt
from app.models.schemas import ChatResponse, ToolName
from app.services import model_service


class AgentError(Exception):
    pass


def _run_generate_3d(user_message: str, llm: LLMClient) -> dict[str, Any]:
    spec = extract_specification(llm, user_message)
    record = model_service.create_model(spec)
    return {
        "tool": "generate_3d",
        "success": True,
        "model_id": record.model_id,
        "status": record.status,
        "file_path": record.file_path,
    }


def _run_edit_model(current_model_id: Optional[str], arguments: dict) -> dict[str, Any]:
    model_id = arguments.get("model_id") or current_model_id
    if not model_id:
        raise AgentError("edit_model requires an existing model; nothing has been generated yet")
    changes = arguments.get("changes") or {}
    record = model_service.edit_model(model_id, changes)
    return {"tool": "edit_model", "success": True, "model_id": record.model_id, "version": record.version, "changes": changes}


def _run_validate_model(current_model_id: Optional[str], arguments: dict) -> dict[str, Any]:
    model_id = arguments.get("model_id") or current_model_id
    if not model_id:
        raise AgentError("validate_model requires an existing model")
    result = model_service.validate_model(model_id)
    return {"tool": "validate_model", "success": True, "model_id": model_id, **result}


def _run_optimize_model(current_model_id: Optional[str], arguments: dict) -> dict[str, Any]:
    model_id = arguments.get("model_id") or current_model_id
    if not model_id:
        raise AgentError("optimize_model requires an existing model")
    operations = arguments.get("operations") or ["make_game_ready"]
    record = model_service.optimize_model(model_id, operations)
    return {"tool": "optimize_model", "success": True, "model_id": record.model_id, "version": record.version}


def _run_export_model(current_model_id: Optional[str], arguments: dict) -> dict[str, Any]:
    model_id = arguments.get("model_id") or current_model_id
    if not model_id:
        raise AgentError("export_model requires an existing model")
    fmt = arguments.get("format", "glb")
    result = model_service.export_model(model_id, fmt)
    return {"tool": "export_model", **result}


import re

GREETINGS = {
    "hi", "hello", "hey", "hi there", "hello there", "good morning",
    "good afternoon", "good evening", "howdy", "sup", "yo", "help",
    "who are you", "what can you do", "thanks", "thank you", "bye", "goodbye"
}


def _is_greeting(text: str) -> bool:
    cleaned = text.strip().lower()
    words = set(re.findall(r"\b\w+\b", cleaned))
    if cleaned in GREETINGS or (len(words) <= 3 and any(g in words for g in ["hi", "hello", "hey", "help", "yo", "sup"])):
        action_keywords = {
            "create", "make", "generate", "build", "design", "export",
            "edit", "change", "add", "draw", "table", "chair", "house",
            "model", "3d", "box", "cube", "car", "wider", "taller"
        }
        if not any(w in words for w in action_keywords):
            return True
    return False


def handle_message(
    user_message: str,
    conversation_id: Optional[str] = None,
    image_base64: Optional[str] = None,
) -> ChatResponse:
    """Orchestrates one turn: User -> (Qwen2.5-VL Vision) -> Agent -> Local LLM -> Tool decision ->
    Tool execution -> Tool result -> LLM -> Final response.
    Maintains conversation id, current model id, and history across turns."""

    llm = get_llm_client()
    convo = conv_state.get_or_create_conversation(conversation_id)
    conv_state.add_message(convo.conversation_id, "user", user_message)

    vision_analysis: Optional[str] = None
    effective_message = user_message

    # Step 1: Vision Model Reading (qwen2.5vl:7b) if image is uploaded
    if image_base64:
        try:
            vision_resp = llm.generate_vision(user_message, image_base64)
            vision_analysis = vision_resp.text
            effective_message = (
                f"Image Visual Features (Analyzed by Qwen2.5-VL): {vision_analysis}\n"
                f"User Instruction: {user_message}"
            )
        except Exception as exc:
            vision_analysis = f"Vision model reading error: {exc}"
            effective_message = user_message

    # Fast-path for greetings & conversational queries (instant reply < 0.05s) when no image is provided
    if not image_base64 and _is_greeting(user_message):
        reply = (
            "Hi! I am your Local AI 3D Model Generator.\n\n"
            "What would you like to create today? Here are some examples you can try:\n"
            "• *'Create a futuristic black and red gaming chair'*\n"
            "• *'Create a low-poly wooden dining table'*\n"
            "• *'Make it wider by 20%'*\n"
            "• *'Export model as OBJ'*"
        )
        conv_state.add_message(convo.conversation_id, "assistant", reply)
        return ChatResponse(
            conversation_id=convo.conversation_id,
            reply=reply,
            model_id=convo.current_model_id,
            tool_calls=[],
        )

    try:
        plan = build_plan(llm, effective_message, convo.current_model_id)
    except PlanningError as exc:
        reply = f"I couldn't understand that request: {exc}"
        conv_state.add_message(convo.conversation_id, "assistant", reply)
        return ChatResponse(
            conversation_id=convo.conversation_id,
            reply=reply,
            vision_analysis=vision_analysis,
            model_id=convo.current_model_id,
            tool_calls=[],
        )

    tool_results: list[dict[str, Any]] = []
    current_model_id = convo.current_model_id

    for step in plan.steps:
        try:
            if step.tool == ToolName.generate_3d:
                result = _run_generate_3d(effective_message, llm)
                current_model_id = result["model_id"]
                conv_state.set_current_model(convo.conversation_id, current_model_id)
            elif step.tool == ToolName.edit_model:
                result = _run_edit_model(current_model_id, step.arguments)
            elif step.tool == ToolName.validate_model:
                result = _run_validate_model(current_model_id, step.arguments)
            elif step.tool == ToolName.optimize_model:
                result = _run_optimize_model(current_model_id, step.arguments)
            elif step.tool == ToolName.export_model:
                result = _run_export_model(current_model_id, step.arguments)
            else:
                raise AgentError(f"tool not registered: {step.tool}")
        except Exception as exc:  # a single failing tool must not crash the turn
            result = {"tool": step.tool.value, "success": False, "error": str(exc)}
        tool_results.append(result)

    reply = _summarize(llm, user_message, tool_results)
    conv_state.add_message(convo.conversation_id, "assistant", reply)

    return ChatResponse(
        conversation_id=convo.conversation_id,
        reply=reply,
        vision_analysis=vision_analysis,
        model_id=current_model_id,
        tool_calls=plan.steps,
    )


import re


def _summarize(llm: LLMClient, user_message: str, tool_results: list[dict]) -> str:
    if not tool_results:
        return "I didn't need to run any tools for that -- could you clarify what you'd like me to build or change?"
    try:
        response = llm.generate(build_summary_prompt(user_message, tool_results), system=SUMMARY_SYSTEM_PROMPT)
        text = re.sub(r"<think>.*?</think>", "", response.text, flags=re.DOTALL).strip()
        return text if text else _template_summary(tool_results)
    except Exception:
        return _template_summary(tool_results)


def _template_summary(tool_results: list[dict]) -> str:
    parts = []
    for result in tool_results:
        tool = result.get("tool")
        if not result.get("success", True):
            parts.append(f"{tool} failed: {result.get('error')}")
        elif tool == "generate_3d":
            parts.append(f"Generated {result.get('model_id')}.")
        elif tool == "edit_model":
            parts.append(f"Updated {result.get('model_id')} to version {result.get('version')}.")
        elif tool == "validate_model":
            parts.append(f"Validated {result.get('model_id')}: valid={result.get('valid')}.")
        elif tool == "optimize_model":
            parts.append(f"Optimized {result.get('model_id')} to version {result.get('version')}.")
        elif tool == "export_model":
            parts.append(f"Exported {result.get('model_id')} as {result.get('format')}.")
    return " ".join(parts) if parts else "Done."
