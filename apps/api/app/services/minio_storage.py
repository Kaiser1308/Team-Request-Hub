from datetime import timedelta
from urllib.parse import urlparse

import httpx
from minio import Minio
from minio.commonconfig import CopySource

from app.core.config import get_settings
from app.core.exceptions import BadRequestError, DomainError

DEFAULT_PRESIGNED_EXPIRY_SECONDS = 300


def _get_client() -> Minio:
    settings = get_settings()
    if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise BadRequestError("MinIO is not configured")

    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region=settings.minio_region,
    )


def _parse_endpoint(endpoint: str, default_secure: bool) -> tuple[str, bool]:
    parsed = urlparse(endpoint if "://" in endpoint else f"//{endpoint}", scheme="https" if default_secure else "http")
    if not parsed.netloc:
        raise BadRequestError("MinIO endpoint is invalid")
    if parsed.path and parsed.path != "/":
        raise BadRequestError("MinIO endpoint must not include a path")
    return parsed.netloc, parsed.scheme == "https"


def _get_presign_client() -> Minio:
    settings = get_settings()
    endpoint = settings.minio_public_endpoint or settings.minio_endpoint
    if not endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise BadRequestError("MinIO is not configured")

    endpoint_host, secure = _parse_endpoint(endpoint, settings.minio_secure)
    return Minio(
        endpoint_host,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
        region=settings.minio_region,
    )


def _bucket_name() -> str:
    return get_settings().minio_bucket


def presigned_put_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> str:
    try:
        return _get_presign_client().presigned_put_object(
            _bucket_name(),
            object_key,
            expires=timedelta(seconds=expires_seconds),
        )
    except Exception as exc:
        raise DomainError("MinIO presigned URL generation failed") from exc


def presigned_get_url(
    object_key: str,
    expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS,
    response_headers: dict[str, str] | None = None,
) -> str:
    try:
        return _get_presign_client().presigned_get_object(
            _bucket_name(),
            object_key,
            expires=timedelta(seconds=expires_seconds),
            response_headers=response_headers,
        )
    except Exception as exc:
        raise DomainError("MinIO presigned URL generation failed") from exc


def copy_object(source_key: str, destination_key: str) -> None:
    try:
        _get_client().copy_object(
            _bucket_name(),
            destination_key,
            CopySource(_bucket_name(), source_key),
        )
    except Exception as exc:
        raise DomainError("MinIO copy failed") from exc


def delete_object(object_key: str) -> None:
    try:
        _get_client().remove_object(_bucket_name(), object_key)
    except Exception as exc:
        raise DomainError("MinIO delete failed") from exc


def get_object_bytes(object_key: str) -> bytes:
    last_exc: Exception | None = None
    clients = (_get_client, _get_presign_client)

    for get_client in clients:
        try:
            response = get_client().get_object(_bucket_name(), object_key)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except Exception as exc:  # pragma: no cover - fallback path
            last_exc = exc
            continue

    raise DomainError("MinIO read failed") from last_exc


def get_object_bytes_via_presigned_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> bytes:
    try:
        url = presigned_get_url(object_key, expires_seconds=expires_seconds)
        response = httpx.get(url, timeout=15.0)
        response.raise_for_status()
        return response.content
    except Exception as exc:
        raise DomainError("MinIO presigned read failed") from exc
