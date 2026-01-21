from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps
from starlette.concurrency import run_in_threadpool

from backend.app.core.config import Settings
from backend.app.services.storage import original_path, preview_path, thumb_path
from backend.app.utils.files import ensure_parent, guess_extension


@dataclass(frozen=True)
class StoredImage:
    image_id: str
    album_id: str
    subfolder_id: str
    filename: str
    original_ext: str
    original_path: str
    thumb_path: str
    preview_path: str
    width: int
    height: int
    created_at: datetime


async def store_upload_as_image(
    *,
    upload: UploadFile,
    image_id: str,
    album_id: str,
    subfolder_id: str,
    settings: Settings,
) -> StoredImage:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are supported")

    ext = guess_extension(upload.filename or "")
    orig = original_path(settings, image_id, ext)
    thm = thumb_path(settings, image_id)
    prv = preview_path(settings, image_id)
    ensure_parent(orig)
    ensure_parent(thm)
    ensure_parent(prv)

    await _write_upload_to_path(upload, orig)
    width, height = await _generate_variants(orig, thm, prv)

    return StoredImage(
        image_id=image_id,
        album_id=album_id,
        subfolder_id=subfolder_id,
        filename=upload.filename or f"{image_id}{ext or ''}",
        original_ext=ext,
        original_path=str(orig),
        thumb_path=str(thm),
        preview_path=str(prv),
        width=width,
        height=height,
        created_at=datetime.now(timezone.utc),
    )


async def _write_upload_to_path(upload: UploadFile, dest: Path) -> None:
    try:
        with dest.open("wb") as f:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
    finally:
        await upload.close()


def _process_image_worker(original: Path, thumb: Path, preview: Path) -> tuple[int, int]:
    with Image.open(original) as img_raw:
        img = ImageOps.exif_transpose(img_raw)
        width, height = img.size

        # Convert if needed
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")

        # Generate thumbnail (512px)
        thumb_img = img.copy()
        thumb_img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        thumb_img.save(thumb, format="JPEG", quality=86, optimize=True, progressive=True)

        # Generate preview (2560px)
        preview_img = img.copy()
        preview_img.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
        preview_img.save(preview, format="JPEG", quality=88, optimize=True, progressive=True)

        return width, height


async def _generate_variants(original: Path, thumb: Path, preview: Path) -> tuple[int, int]:
    try:
        return await run_in_threadpool(_process_image_worker, original, thumb, preview)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file") from e
