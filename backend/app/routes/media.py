from __future__ import annotations

import mimetypes
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse

from backend.app.core.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.utils.security import decode_share_jwt


router = APIRouter(tags=["media"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


def _ensure_share_access(img: dict[str, Any], share: dict[str, Any]) -> None:
    if img["album_id"] != share["album_id"]:
        raise _not_found()
    sub = share.get("subfolder_id")
    if sub and img["subfolder_id"] != sub:
        raise _not_found()


async def _require_admin_or_share_access(image_id: str, request: Request, settings: Settings) -> dict[str, Any]:
    db = get_db()
    img = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not img:
        raise _not_found()

    qp_admin = request.query_params.get("admin")
    admin_token = qp_admin or request.headers.get("X-Admin-Token")
    if admin_token and admin_token == settings.admin_token:
        return img

    token = request.query_params.get("t")
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorized")
    session = decode_share_jwt(token, settings)

    share = await db.shares.find_one({"id": session.share_id}, {"_id": 0, "password_hash": 0})
    if not share:
        raise _not_found()
    expires_at = share.get("expires_at")
    if expires_at and isinstance(expires_at, datetime) and expires_at <= _now():
        raise _not_found()
    _ensure_share_access(img, share)
    return img


@router.get("/media/thumb/{image_id}")
async def get_thumb(image_id: str, request: Request, settings: Settings = Depends(get_settings)) -> FileResponse:
    img = await _require_admin_or_share_access(image_id, request, settings)
    path = img["thumb_path"]
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/media/preview/{image_id}")
async def get_preview(image_id: str, request: Request, settings: Settings = Depends(get_settings)) -> FileResponse:
    img = await _require_admin_or_share_access(image_id, request, settings)
    # Fallback to thumb if preview doesn't exist (e.g. old images)
    path = img.get("preview_path") or img["thumb_path"]
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/media/original/{image_id}")
async def get_original(image_id: str, request: Request, settings: Settings = Depends(get_settings)) -> FileResponse:
    img = await _require_admin_or_share_access(image_id, request, settings)
    path = img["original_path"]
    mime, _ = mimetypes.guess_type(path)
    return FileResponse(
        path,
        media_type=mime or "application/octet-stream",
        filename=img.get("filename") or f"{image_id}",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
