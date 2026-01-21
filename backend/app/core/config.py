from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    database_name: str = Field(default="proofflow", alias="DATABASE_NAME")

    admin_token: str = Field(alias="ADMIN_TOKEN")
    jwt_secret: str = Field(alias="JWT_SECRET")

    public_base_url: Annotated[str, Field(alias="PUBLIC_BASE_URL")] = "http://localhost:8000"
    storage_path: Annotated[str, Field(alias="STORAGE_PATH")] = "/data"

    cors_origins: Annotated[str, Field(alias="CORS_ORIGINS")] = ""

    def parsed_cors_origins(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        return [o.strip() for o in raw.split(",") if o.strip()]

    def absolute_share_url(self, share_id: str) -> str:
        base = self.public_base_url.rstrip("/")
        return f"{base}/share/{share_id}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
