from __future__ import annotations

import pytest
import requests

from app.llm.client import LLMError, OllamaClient


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json_data = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._json_data


def test_generate_success(monkeypatch):
    def fake_post(url, json, timeout):
        assert json["model"] == "test-model"
        assert json["prompt"] == "hello"
        return _FakeResponse(200, {"response": "hi there", "model": "test-model"})

    monkeypatch.setattr(requests, "post", fake_post)
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    result = client.generate("hello")
    assert result.text == "hi there"
    assert result.model == "test-model"


def test_generate_raises_on_connection_error(monkeypatch):
    def fake_post(*args, **kwargs):
        raise requests.ConnectionError("no route to host")

    monkeypatch.setattr(requests, "post", fake_post)
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    with pytest.raises(LLMError):
        client.generate("hello")


def test_generate_raises_on_empty_response(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *a, **k: _FakeResponse(200, {"response": ""}))
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    with pytest.raises(LLMError):
        client.generate("hello")


def test_generate_raises_on_http_error(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *a, **k: _FakeResponse(500))
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    with pytest.raises(LLMError):
        client.generate("hello")


def test_is_available_true(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: _FakeResponse(200))
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    assert client.is_available() is True


def test_is_available_false_on_connection_error(monkeypatch):
    def fake_get(*args, **kwargs):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(requests, "get", fake_get)
    client = OllamaClient(base_url="http://localhost:11434", model="test-model")
    assert client.is_available() is False


def test_ollama_client_qwen_generate(monkeypatch):
    def fake_post(url, json, timeout):
        assert json["model"] == "qwen3:8b"
        assert json["prompt"] == "Create a 3D gaming chair"
        return _FakeResponse(200, {"response": "Processed request for 3D gaming chair", "model": "qwen3:8b"})

    monkeypatch.setattr(requests, "post", fake_post)
    client = OllamaClient(base_url="http://localhost:11434", model="qwen3:8b")
    result = client.generate("Create a 3D gaming chair")
    assert result.text == "Processed request for 3D gaming chair"
    assert result.model == "qwen3:8b"

