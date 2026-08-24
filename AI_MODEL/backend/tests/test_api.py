from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import app.api.routes.models as models_routes
from app.llm.client import LLMResponse


class _StaticLLM:
    def __init__(self, text):
        self._text = text

    def generate(self, prompt, system=None):
        return LLMResponse(text=self._text, model="static", raw={})

    def is_available(self):
        return True


@pytest.fixture
def client(monkeypatch):
    spec_json = json.dumps(
        {
            "object": "gaming chair",
            "style": "futuristic",
            "materials": ["leather", "metal"],
            "colors": ["black", "red"],
            "parts": ["seat", "backrest"],
            "complexity": "medium",
        }
    )
    monkeypatch.setattr(models_routes, "get_llm_client", lambda: _StaticLLM(spec_json))

    from app.main import create_app

    return TestClient(create_app())


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] in ("healthy", "ok")


def test_create_and_get_model(client):
    create_resp = client.post("/models", json={"prompt": "Create a futuristic gaming chair"})
    assert create_resp.status_code == 200
    body = create_resp.json()
    model_id = body["model_id"]
    assert body["object"] == "gaming chair"

    get_resp = client.get(f"/models/{model_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["model_id"] == model_id


def test_get_missing_model_returns_404(client):
    resp = client.get("/models/does_not_exist")
    assert resp.status_code == 404


def test_edit_validate_optimize_export_flow(client):
    create_resp = client.post("/models", json={"prompt": "Create a table"})
    model_id = create_resp.json()["model_id"]

    edit_resp = client.post(f"/models/{model_id}/edit", json={"changes": {"width": "+20%"}})
    assert edit_resp.status_code == 200
    assert edit_resp.json()["version"] == 2

    validate_resp = client.post(f"/models/{model_id}/validate")
    assert validate_resp.status_code == 200
    assert validate_resp.json()["valid"] is True

    optimize_resp = client.post(f"/models/{model_id}/optimize", json={"operations": ["make_game_ready"]})
    assert optimize_resp.status_code == 200
    assert optimize_resp.json()["version"] == 3

    export_resp = client.post(f"/models/{model_id}/export", json={"format": "glb"})
    assert export_resp.status_code == 200
    assert export_resp.json()["success"] is True


def test_export_invalid_format_returns_400(client):
    create_resp = client.post("/models", json={"prompt": "Create a table"})
    model_id = create_resp.json()["model_id"]
    resp = client.post(f"/models/{model_id}/export", json={"format": "stl"})
    assert resp.status_code == 400


def test_list_models(client):
    client.post("/models", json={"prompt": "Create a chair"})
    resp = client.get("/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_conversation_not_found_returns_404(client):
    resp = client.get("/conversations/does_not_exist")
    assert resp.status_code == 404
