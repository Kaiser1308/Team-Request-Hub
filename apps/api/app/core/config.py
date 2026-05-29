from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Team Request Hub API"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    log_request_timing: bool = False

    telegram_bot_token: str | None = None
    telegram_bot_username: str | None = None
    telegram_webhook_secret: str | None = None
    app_base_url: str = "http://localhost:3000"

    minio_endpoint: str | None = None
    minio_region: str = "us-east-1"
    minio_bucket: str = "team-files"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_secure: bool = True
    minio_public_endpoint: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Team Request Hub"

    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str | None = None

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
