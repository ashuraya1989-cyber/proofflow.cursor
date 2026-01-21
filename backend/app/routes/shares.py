from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.core.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import ImageOut, ShareAuthIn, ShareAuthOut, ShareScopeOut
from backend.app.utils.security import create_share_jwt, get_share_session, verify_password


router = APIRouter(prefix="/api/shares", tags=["shares"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _share_not_found() -> HTTPException:
    # do not leak whether share exists vs wrong password in auth step
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")


def _ensure_not_expired(doc: dict[str, Any]) -> None:
    expires_at = doc.get("expires_at")
    if expires_at and isinstance(expires_at, datetime) and expires_at <= _now():
        raise _share_not_found()


def _image_doc_to_out(doc: dict[str, Any]) -> ImageOut:
    image_id = doc["id"]
    return ImageOut(
        id=image_id,
        album_id=doc["album_id"],
        subfolder_id=doc["subfolder_id"],
        filename=doc["filename"],
        width=doc["width"],
        height=doc["height"],
        created_at=doc["created_at"],
        thumb_url=f"/media/thumb/{image_id}",
        preview_url=f"/media/preview/{image_id}",
        image_url=f"/media/original/{image_id}",
    )


@router.get("/{share_id}/meta", response_model=ShareScopeOut)
async def get_share_meta(share_id: str) -> ShareScopeOut:
    db = get_db()
    share = await db.shares.find_one({"id": share_id}, {"_id": 0, "password_hash": 0})
    if not share:
        raise _share_not_found()
    _ensure_not_expired(share)
    if share.get("subfolder_id"):
        mode = "single_subfolder"
        title = "Selected subfolder"
    else:
        mode = "album_all_subfolders"
        title = "All photos"
    return ShareScopeOut(
        id=share["id"],
        album_id=share["album_id"],
        subfolder_id=share.get("subfolder_id"),
        mode=mode,
        title=title,
    )


@router.post("/{share_id}/auth", response_model=ShareAuthOut)
async def auth_share(share_id: str, payload: ShareAuthIn, settings: Settings = Depends(get_settings)) -> ShareAuthOut:
    db = get_db()
    share = await db.shares.find_one({"id": share_id}, {"_id": 0})
    if not share:
        raise _share_not_found()
    _ensure_not_expired(share)
    if not verify_password(payload.password, share["password_hash"]):
        raise _share_not_found()

    now = _now()
    session_exp = now + timedelta(hours=12)
    share_exp = share.get("expires_at")
    token_expires_at = session_exp
    if isinstance(share_exp, datetime):
        token_expires_at = min(session_exp, share_exp)

    token = create_share_jwt(share_id=share_id, settings=settings, ttl_seconds=int((token_expires_at - now).total_seconds()))
    return ShareAuthOut(token=token, token_expires_at=token_expires_at)


@router.get("/{share_id}/images", response_model=list[ImageOut])
async def list_share_images(
    share_id: str,
    session=Depends(get_share_session),
) -> list[ImageOut]:
    if session.share_id != share_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    db = get_db()
    share = await db.shares.find_one({"id": share_id}, {"_id": 0, "password_hash": 0})
    if not share:
        raise _share_not_found()
    _ensure_not_expired(share)
    q: dict[str, Any] = {"album_id": share["album_id"]}
    if share.get("subfolder_id"):
        q["subfolder_id"] = share["subfolder_id"]
    cur = db.images.find(q, {"_id": 0}).sort("created_at", -1)
    return [_image_doc_to_out(d) async for d in cur]
