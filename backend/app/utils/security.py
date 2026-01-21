from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.app.core.config import Settings, get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def require_admin(request: Request, settings: Settings = Depends(get_settings)) -> None:
    token = request.headers.get("X-Admin-Token")
    if not token or token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token required")


@dataclass(frozen=True)
class ShareSession:
    share_id: str
    exp: int


def create_share_jwt(share_id: str, settings: Settings, ttl_seconds: int = 12 * 60 * 60) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": share_id,
        "iat": now,
        "exp": now + ttl_seconds,
        "typ": "share",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_share_jwt(token: str, settings: Settings) -> ShareSession:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e
    if payload.get("typ") != "share":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    share_id = payload.get("sub")
    exp = payload.get("exp")
    if not isinstance(share_id, str) or not isinstance(exp, int):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return ShareSession(share_id=share_id, exp=exp)


async def get_share_session(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> ShareSession:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    return decode_share_jwt(creds.credentials, settings)
