from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.planner import PlanningError, extract_specification
from app.llm.client import get_llm_client
from app.models.schemas import (
    EditModelRequest,
    ExportModelRequest,
    ModelCreateRequest,
    ModelOut,
    OptimizeModelRequest,
)
from app.services import model_service

router = APIRouter()


def _to_out(record) -> ModelOut:
    return ModelOut(
        model_id=record.model_id,
        version=record.version,
        object=record.object,
        style=record.style,
        materials=record.materials,
        colors=record.colors,
        parts=record.parts,
        complexity=record.complexity,
        status=record.status,
        file_path=record.file_path,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post("/models", response_model=ModelOut)
def create_model(request: ModelCreateRequest) -> ModelOut:
    llm = get_llm_client()
    try:
        spec = extract_specification(llm, request.prompt)
    except PlanningError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    record = model_service.create_model(spec)
    return _to_out(record)


@router.get("/models", response_model=list[ModelOut])
def list_models() -> list[ModelOut]:
    return [_to_out(r) for r in model_service.list_models()]


@router.get("/models/{model_id}", response_model=ModelOut)
def get_model(model_id: str) -> ModelOut:
    try:
        record = model_service.get_model(model_id)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")
    return _to_out(record)


@router.post("/models/{model_id}/generate", response_model=ModelOut)
def regenerate_model(model_id: str) -> ModelOut:
    """Placeholder re-generation hook: today the mock generator has
    nothing to redo, so this just returns current state. Once
    THREED_PROVIDER=real is wired in (Phase 21), this becomes the entry
    point for re-running generation against the stored specification."""
    try:
        record = model_service.get_model(model_id)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")
    return _to_out(record)


@router.post("/models/{model_id}/edit", response_model=ModelOut)
def edit_model(model_id: str, request: EditModelRequest) -> ModelOut:
    try:
        record = model_service.edit_model(model_id, request.changes)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")
    return _to_out(record)


@router.post("/models/{model_id}/validate")
def validate_model(model_id: str) -> dict:
    try:
        return model_service.validate_model(model_id)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")


@router.post("/models/{model_id}/optimize", response_model=ModelOut)
def optimize_model(model_id: str, request: OptimizeModelRequest) -> ModelOut:
    try:
        record = model_service.optimize_model(model_id, request.operations)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")
    return _to_out(record)


@router.post("/models/{model_id}/export")
def export_model(model_id: str, request: ExportModelRequest) -> dict:
    try:
        return model_service.export_model(model_id, request.format)
    except model_service.ModelNotFoundError:
        raise HTTPException(status_code=404, detail=f"model not found: {model_id}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
