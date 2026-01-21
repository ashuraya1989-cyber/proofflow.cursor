from __future__ import annotations

import secrets
import uuid


def new_image_id() -> str:
    return uuid.uuid4().hex


def new_album_id() -> str:
    return uuid.uuid4().hex


def new_subfolder_id() -> str:
    return uuid.uuid4().hex


def new_share_id() -> str:
    # short but unguessable (18 chars url-safe ~ 108 bits)
    return secrets.token_urlsafe(14)
