from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolated_environment(tmp_path, monkeypatch):
    """Every test gets its own SQLite DB and outputs dir, and a clean
    Settings cache, so tests never touch the real project's data/outputs."""
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path / "outputs"))
    monkeypatch.setenv("THREED_PROVIDER", "mock")

    from app.config import get_settings

    get_settings.cache_clear()

    from app.services import db

    db.init_db()

    yield

    get_settings.cache_clear()
