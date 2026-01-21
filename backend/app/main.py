from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.app.core.config import get_settings
from backend.app.db import connect, disconnect, get_db
from backend.app.routes.admin import router as admin_router
from backend.app.routes.media import router as media_router
from backend.app.routes.shares import router as shares_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="ProofFlow", version="1.0.0")

    cors = settings.parsed_cors_origins()
    if cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.on_event("startup")
    async def _startup() -> None:
        connect()
        db = get_db()
        await db.albums.create_index([("id", 1)], unique=True)
        await db.albums.create_index([("name", 1)], unique=True)

        await db.subfolders.create_index([("id", 1)], unique=True)
        await db.subfolders.create_index([("album_id", 1), ("name", 1)], unique=True)

        await db.images.create_index([("id", 1)], unique=True)
        await db.images.create_index([("album_id", 1), ("created_at", -1)])
        await db.images.create_index([("album_id", 1), ("subfolder_id", 1), ("created_at", -1)])

        await db.shares.create_index([("id", 1)], unique=True)
        await db.shares.create_index([("expires_at", 1)])

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        disconnect()

    app.include_router(admin_router)
    app.include_router(shares_router)
    app.include_router(media_router)

    static_dir = Path(__file__).parent / "static"
    index_file = static_dir / "index.html"

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        # API and media are routed before this handler. Everything else is either:
        # - a real static file under the built frontend dist, or
        # - an SPA route -> serve index.html
        if not index_file.exists():
            raise HTTPException(status_code=404, detail="Frontend not built")

        if full_path:
            candidate = (static_dir / full_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(static_dir.resolve()):
                return FileResponse(candidate)

        return FileResponse(index_file)

    return app


app = create_app()
