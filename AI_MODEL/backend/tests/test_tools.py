from __future__ import annotations

import pytest

from app.config import get_settings
from app.models.schemas import ThreeDSpecification
from app.tools.edit_model import MockMeshEditor
from app.tools.export_model import MockModelExporter
from app.tools.generate_3d import MockThreeDGenerator
from app.tools.optimize_model import MockModelOptimizer
from app.tools.validate_model import MockModelValidator


def test_generate_writes_placeholder_glb():
    spec = ThreeDSpecification(object="table", materials=["wood"])
    result = MockThreeDGenerator().generate(spec, "model_test1")
    assert result["success"] is True
    assert result["status"] == "generated"

    absolute = get_settings().resolve(result["file_path"])
    assert absolute.exists()
    with open(absolute, "rb") as f:
        assert f.read(4) == b"glTF"


def test_edit_bumps_version():
    result = MockMeshEditor().edit("model_test1", 1, {"width": "+20%"})
    assert result["version"] == 2
    assert result["changes"] == {"width": "+20%"}


def test_validate_reports_missing_file():
    result = MockModelValidator().validate("model_missing", "outputs/model_missing/model.glb")
    assert result["valid"] is False
    assert result["errors"]


def test_validate_reports_valid_for_existing_file():
    spec = ThreeDSpecification(object="table")
    generated = MockThreeDGenerator().generate(spec, "model_test2")
    result = MockModelValidator().validate("model_test2", generated["file_path"])
    assert result["valid"] is True
    assert result["errors"] == []


def test_optimize_reduces_polygon_count_for_game_ready():
    result = MockModelOptimizer().optimize("model_test1", 1, ["make_game_ready"])
    assert result["version"] == 2
    assert result["polygon_count_after"] < result["polygon_count_before"]


def test_optimize_ignores_unknown_operations():
    result = MockModelOptimizer().optimize("model_test1", 1, ["teleport_to_mars"])
    assert result["operations"] == []
    assert result["polygon_count_after"] == result["polygon_count_before"]


def test_export_glb_writes_file():
    result = MockModelExporter().export("model_test1", "", "glb")
    assert get_settings().resolve(result["file_path"]).exists()


def test_export_rejects_unsupported_format():
    with pytest.raises(ValueError):
        MockModelExporter().export("model_test1", "", "stl")
