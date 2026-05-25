from datetime import timedelta

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


def _bucket_name() -> str:
    return get_settings().minio_bucket


def presigned_put_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> str:
    try:
        return _get_client().presigned_put_object(
            _bucket_name(),
            object_key,
            expires=timedelta(seconds=expires_seconds),
        )
    except Exception as exc:
        raise DomainError("MinIO presigned URL generation failed") from exc


def presigned_get_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> str:
    try:
        return _get_client().presigned_get_object(
            _bucket_name(),
            object_key,
            expires=timedelta(seconds=expires_seconds),
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
