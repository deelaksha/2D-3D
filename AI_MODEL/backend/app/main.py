from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import chat, conversations, health, models
from app.config import get_settings
from app.services import db

logger = logging.getLogger("app")


def _background_warmup():
    try:
        from app.llm.client import get_llm_client
        client = get_llm_client()
        if client.is_available() and not client.is_awake():
            logger.info("Awakening local AI model in background...")
            res = client.awaken(keep_alive="60m")
            logger.info("Local AI model background awaken complete: %s", res)
    except Exception as exc:
        logger.warning("Background AI model warmup skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_thread = threading.Thread(target=_background_warmup, daemon=True)
    warmup_thread.start()
    yield


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
        lifespan=lifespan,
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
