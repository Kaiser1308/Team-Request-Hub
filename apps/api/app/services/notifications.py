from app.repositories import notification_repository


def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> None:
    notification_repository.create_notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        message=message,
    )


def notify_assigned(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"You were assigned a request: {request['title']}",
    )


def notify_request_picked_up(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"Your request was picked up: {request['title']}",
    )


def notify_reassigned(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="reassigned",
        message=f"You were reassigned a request: {request['title']}",
    )


def notify_status_changed(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="status_changed",
        message=f"Request status changed: {request['title']}",
    )


def notify_done(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="done",
        message=f"Request was completed: {request['title']}",
    )


def notify_cancelled(user_id: str, request: dict) -> None:
    create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="cancelled",
        message=f"Request was cancelled: {request['title']}",
    )


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    return notification_repository.list_notifications(user_id, unread_only)


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    return notification_repository.mark_notification_read(notification_id, user_id)


def mark_all_notifications_read(user_id: str) -> dict:
    return {"updated": notification_repository.mark_all_notifications_read(user_id)}
