from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> app -> backend -> Practice (project root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Central configuration. All values are overridable via environment
    variables or a .env file at the project root -- nothing is hard-coded
    (Rule 6), and the LLM/3D provider are swappable without code changes
    (Rules 3 and 5).
    """

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM
    llm_provider: str = "ollama"
    llm_model: str = "qwen3:8b"
    llm_vision_model: str = "qwen2.5vl:7b"
    llm_base_url: str = "http://localhost:11434"
    llm_timeout_seconds: int = 300

    # 3D generation pipeline
    threed_provider: str = "mock"

    # Storage
    database_path: str = "data/app.db"
    outputs_dir: str = "outputs"

    # App
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    def resolve(self, relative_path: str) -> Path:
        """Resolve a path stored/returned as project-root-relative (e.g.
        "outputs/model_001/model.glb") to an absolute filesystem path."""
        path = Path(relative_path)
        return path if path.is_absolute() else PROJECT_ROOT / path

    @property
    def database_path_abs(self) -> Path:
        return self.resolve(self.database_path)

    @property
    def outputs_dir_abs(self) -> Path:
        return self.resolve(self.outputs_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
