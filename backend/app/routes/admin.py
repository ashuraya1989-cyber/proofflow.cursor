from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.app.core.config import Settings, get_settings
from backend.app.db import get_db
from backend.app.models import (
    AlbumCreateIn,
    AlbumOut,
    ImageOut,
    ShareCreateIn,
    ShareOut,
    SubfolderCreateIn,
    SubfolderOut,
)
from backend.app.services.images import store_upload_as_image
from backend.app.utils.ids import new_album_id, new_image_id, new_share_id, new_subfolder_id
from backend.app.utils.security import hash_password, require_admin


router = APIRouter(prefix="/api/admin", tags=["admin"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _album_doc_to_out(doc: dict[str, Any]) -> AlbumOut:
    return AlbumOut(id=doc["id"], name=doc["name"], created_at=doc["created_at"])


def _subfolder_doc_to_out(doc: dict[str, Any]) -> SubfolderOut:
    return SubfolderOut(id=doc["id"], album_id=doc["album_id"], name=doc["name"], created_at=doc["created_at"])


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


@router.get("/albums", response_model=list[AlbumOut], dependencies=[Depends(require_admin)])
async def list_albums() -> list[AlbumOut]:
    db = get_db()
    cur = db.albums.find({}, {"_id": 0}).sort("created_at", -1)
    return [_album_doc_to_out(d) async for d in cur]


@router.post("/albums", response_model=AlbumOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_album(payload: AlbumCreateIn) -> AlbumOut:
    db = get_db()
    existing = await db.albums.find_one({"name": payload.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Album name already exists")
    doc = {"id": new_album_id(), "name": payload.name, "created_at": _now()}
    await db.albums.insert_one(doc)
    return _album_doc_to_out(doc)


@router.get("/subfolders", response_model=list[SubfolderOut], dependencies=[Depends(require_admin)])
async def list_subfolders(album_id: str) -> list[SubfolderOut]:
    db = get_db()
    cur = db.subfolders.find({"album_id": album_id}, {"_id": 0}).sort("created_at", -1)
    return [_subfolder_doc_to_out(d) async for d in cur]


@router.post(
    "/subfolders",
    response_model=SubfolderOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_subfolder(payload: SubfolderCreateIn) -> SubfolderOut:
    db = get_db()
    album = await db.albums.find_one({"id": payload.album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
    existing = await db.subfolders.find_one({"album_id": payload.album_id, "name": payload.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subfolder name already exists in album")
    doc = {"id": new_subfolder_id(), "album_id": payload.album_id, "name": payload.name, "created_at": _now()}
    await db.subfolders.insert_one(doc)
    return _subfolder_doc_to_out(doc)


@router.get("/images", response_model=list[ImageOut], dependencies=[Depends(require_admin)])
async def list_images(album_id: str, subfolder_id: str | None = None) -> list[ImageOut]:
    db = get_db()
    q: dict[str, Any] = {"album_id": album_id}
    if subfolder_id:
        q["subfolder_id"] = subfolder_id
    cur = db.images.find(q, {"_id": 0}).sort("created_at", -1)
    return [_image_doc_to_out(d) async for d in cur]


@router.post("/upload", response_model=list[ImageOut], dependencies=[Depends(require_admin)])
async def bulk_upload(
    album_id: str,
    subfolder_id: str,
    files: list[UploadFile] = File(...),
    settings: Settings = Depends(get_settings),
) -> list[ImageOut]:
    db = get_db()
    album = await db.albums.find_one({"id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
    sub = await db.subfolders.find_one({"id": subfolder_id, "album_id": album_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subfolder not found")

    outs: list[ImageOut] = []
    for upload in files:
        image_id = new_image_id()
        stored = await store_upload_as_image(
            upload=upload,
            image_id=image_id,
            album_id=album_id,
            subfolder_id=subfolder_id,
            settings=settings,
        )
        doc = {
            "id": stored.image_id,
            "album_id": stored.album_id,
            "subfolder_id": stored.subfolder_id,
            "filename": stored.filename,
            "original_ext": stored.original_ext,
            "original_path": stored.original_path,
            "thumb_path": stored.thumb_path,
            "preview_path": stored.preview_path,
            "width": stored.width,
            "height": stored.height,
            "created_at": stored.created_at,
        }
        await db.images.insert_one(doc)
        outs.append(_image_doc_to_out(doc))
    return outs


@router.post("/shares", response_model=ShareOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_share(payload: ShareCreateIn, settings: Settings = Depends(get_settings)) -> ShareOut:
    db = get_db()
    album = await db.albums.find_one({"id": payload.album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
    if payload.subfolder_id:
        sub = await db.subfolders.find_one({"id": payload.subfolder_id, "album_id": payload.album_id}, {"_id": 0})
        if not sub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subfolder not found")

    share_id = new_share_id()
    created_at = _now()
    expires_at = created_at + timedelta(hours=payload.expires_in_hours) if payload.expires_in_hours else None
    doc = {
        "id": share_id,
        "album_id": payload.album_id,
        "subfolder_id": payload.subfolder_id,
        "password_hash": hash_password(payload.password),
        "created_at": created_at,
        "expires_at": expires_at,
    }
    await db.shares.insert_one(doc)
    return ShareOut(
        id=share_id,
        album_id=payload.album_id,
        subfolder_id=payload.subfolder_id,
        created_at=created_at,
        expires_at=expires_at,
        url=settings.absolute_share_url(share_id),
    )
