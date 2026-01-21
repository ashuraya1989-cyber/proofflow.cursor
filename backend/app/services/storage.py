from __future__ import annotations

from pathlib import Path

from backend.app.core.config import Settings


def originals_root(settings: Settings) -> Path:
    return Path(settings.storage_path) / "originals"


def thumbs_root(settings: Settings) -> Path:
    return Path(settings.storage_path) / "thumbs"


def previews_root(settings: Settings) -> Path:
    return Path(settings.storage_path) / "previews"


def original_path(settings: Settings, image_id: str, ext: str) -> Path:
    ext_clean = ext if ext.startswith(".") else (f".{ext}" if ext else "")
    return originals_root(settings) / f"{image_id}{ext_clean}"


def thumb_path(settings: Settings, image_id: str) -> Path:
    return thumbs_root(settings) / f"{image_id}.jpg"


def preview_path(settings: Settings, image_id: str) -> Path:
    return previews_root(settings) / f"{image_id}.jpg"
