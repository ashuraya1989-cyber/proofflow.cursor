from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AlbumCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AlbumOut(BaseModel):
    id: str
    name: str
    created_at: datetime


class SubfolderCreateIn(BaseModel):
    album_id: str
    name: str = Field(min_length=1, max_length=120)


class SubfolderOut(BaseModel):
    id: str
    album_id: str
    name: str
    created_at: datetime


class ImageOut(BaseModel):
    id: str
    album_id: str
    subfolder_id: str
    filename: str
    width: int
    height: int
    created_at: datetime
    thumb_url: str
    preview_url: str
    image_url: str


class ShareCreateIn(BaseModel):
    album_id: str
    subfolder_id: str | None = None
    password: str = Field(min_length=4, max_length=200)
    expires_in_hours: int | None = Field(default=72, ge=1, le=24 * 30)


class ShareOut(BaseModel):
    id: str
    album_id: str
    subfolder_id: str | None
    created_at: datetime
    expires_at: datetime | None
    url: str


class ShareAuthIn(BaseModel):
    password: str = Field(min_length=4, max_length=200)


class ShareAuthOut(BaseModel):
    token: str
    token_expires_at: datetime


class ShareScopeOut(BaseModel):
    id: str
    album_id: str
    subfolder_id: str | None
    mode: Literal["album_all_subfolders", "single_subfolder"]
    title: str
