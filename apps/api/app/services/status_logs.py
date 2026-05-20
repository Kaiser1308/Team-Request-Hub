from app.repositories import status_log_repository


def record_status_change(
    *,
    request_id: str,
    from_status: str | None,
    to_status: str,
    changed_by: str,
    reason: str | None,
) -> None:
    status_log_repository.create_status_log(
        request_id=request_id,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        reason=reason,
    )


def list_status_logs(request_id: str) -> list[dict]:
    return status_log_repository.list_status_logs(request_id)
