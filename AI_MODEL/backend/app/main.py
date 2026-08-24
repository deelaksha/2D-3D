from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import chat, conversations, health, models
from app.config import get_settings
from app.services import db

logger = logging.getLogger("app")


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    db.init_db()
    settings.outputs_dir_abs.mkdir(parents=True, exist_ok=True)

    app = FastAPI(
        title="Local AI 3D Model Generator",
        description="Local, mock-first pipeline: Frontend -> FastAPI -> Agent -> Local LLM -> Tools.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(chat.router, tags=["chat"])
    app.include_router(models.router, tags=["models"])
    app.include_router(conversations.router, tags=["conversations"])

    # Serves generated/exported assets (e.g. /outputs/model_001/model.glb)
    # so the frontend viewer and download button can fetch files directly.
    app.mount("/outputs", StaticFiles(directory=str(settings.outputs_dir_abs)), name="outputs")

    return app


app = create_app()
