from app.repositories import assignment_repository


def record_assignment(
    *,
    request_id: str,
    from_user_id: str | None,
    to_user_id: str,
    assigned_by: str,
    reason: str | None,
) -> None:
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        assigned_by=assigned_by,
        reason=reason,
    )


def list_assignment_history(request_id: str) -> list[dict]:
    return assignment_repository.list_assignment_history(request_id)
