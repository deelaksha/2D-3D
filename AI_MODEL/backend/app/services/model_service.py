from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.models.schemas import ThreeDSpecification
from app.models.state import ModelRecord
from app.services import db
from app.tools.edit_model import get_editor
from app.tools.export_model import get_exporter
from app.tools.generate_3d import get_generator
from app.tools.optimize_model import get_optimizer
from app.tools.validate_model import get_validator


class ModelNotFoundError(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_record(row) -> ModelRecord:
    return ModelRecord(
        model_id=row["model_id"],
        version=row["version"],
        object=row["object"],
        style=row["style"],
        materials=db.loads(row["materials"]) or [],
        colors=db.loads(row["colors"]) or [],
        parts=db.loads(row["parts"]) or [],
        complexity=row["complexity"],
        status=row["status"],
        file_path=row["file_path"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def _log_history(conn, model_id: str, version: int, action: str, payload: dict[str, Any]) -> None:
    conn.execute(
        "INSERT INTO model_history (model_id, version, action, payload, created_at) VALUES (?, ?, ?, ?, ?)",
        (model_id, version, action, db.dumps(payload), _now()),
    )


def create_model(spec: ThreeDSpecification) -> ModelRecord:
    model_id = f"model_{uuid.uuid4().hex[:8]}"
    result = get_generator().generate(spec, model_id)

    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            """INSERT INTO models
               (model_id, version, object, style, materials, colors, parts, complexity,
                status, file_path, created_at, updated_at)
               VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                model_id,
                spec.object,
                spec.style,
                db.dumps(spec.materials),
                db.dumps(spec.colors),
                db.dumps(spec.parts),
                spec.complexity.value,
                result["status"],
                result["file_path"],
                now,
                now,
            ),
        )
        _log_history(conn, model_id, 1, "generate_3d", result)

    return get_model(model_id)


def get_model(model_id: str) -> ModelRecord:
    with db.get_connection() as conn:
        row = conn.execute("SELECT * FROM models WHERE model_id = ?", (model_id,)).fetchone()
    if row is None:
        raise ModelNotFoundError(model_id)
    return _row_to_record(row)


def list_models() -> list[ModelRecord]:
    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM models ORDER BY created_at DESC").fetchall()
    return [_row_to_record(row) for row in rows]


def edit_model(model_id: str, changes: dict[str, Any]) -> ModelRecord:
    record = get_model(model_id)
    result = get_editor().edit(model_id, record.version, changes)

    materials = list(record.materials)
    colors = list(record.colors)
    if "material" in changes:
        materials = [changes["material"]]
    if "color" in changes:
        colors = [changes["color"]]

    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            """UPDATE models SET version = ?, materials = ?, colors = ?, status = 'edited', updated_at = ?
               WHERE model_id = ?""",
            (result["version"], db.dumps(materials), db.dumps(colors), now, model_id),
        )
        _log_history(conn, model_id, result["version"], "edit_model", result)

    return get_model(model_id)


def validate_model(model_id: str) -> dict[str, Any]:
    record = get_model(model_id)
    result = get_validator().validate(model_id, record.file_path or "")
    with db.get_connection() as conn:
        _log_history(conn, model_id, record.version, "validate_model", result)
    return result


def optimize_model(model_id: str, operations: list[str]) -> ModelRecord:
    record = get_model(model_id)
    result = get_optimizer().optimize(model_id, record.version, operations)

    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE models SET version = ?, status = 'optimized', updated_at = ? WHERE model_id = ?",
            (result["version"], now, model_id),
        )
        _log_history(conn, model_id, result["version"], "optimize_model", result)

    return get_model(model_id)


def export_model(model_id: str, format: str) -> dict[str, Any]:
    record = get_model(model_id)
    result = get_exporter().export(model_id, record.file_path or "", format)

    now = _now()
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE models SET status = 'exported', updated_at = ? WHERE model_id = ?",
            (now, model_id),
        )
        _log_history(conn, model_id, record.version, "export_model", result)

    return result
