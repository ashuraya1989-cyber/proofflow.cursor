from __future__ import annotations

import re
from pathlib import Path


_unsafe = re.compile(r"[^a-zA-Z0-9._-]+")


def safe_segment(segment: str) -> str:
    seg = (segment or "").strip()
    if not seg:
        return "untitled"
    seg = _unsafe.sub("-", seg).strip("-")
    return seg[:80] or "untitled"


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def guess_extension(filename: str) -> str:
    base = (filename or "").strip()
    if "." not in base:
        return ""
    ext = base.rsplit(".", 1)[-1].lower()
    if not ext or len(ext) > 8:
        return ""
    return f".{ext}"
