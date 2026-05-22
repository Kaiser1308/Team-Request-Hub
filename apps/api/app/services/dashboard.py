from app.schemas.users import CurrentUser
from app.services import notifications, request_service


def get_dashboard_summary(current_user: CurrentUser) -> dict:
    assigned_recent = request_service.list_requests("assigned", current_user, limit=10)
    created_recent = request_service.list_requests("created", current_user, limit=10)
    pool_recent = request_service.list_requests("pool", current_user, limit=10)
    done_recent = request_service.list_requests("done", current_user, limit=10)
    unread_notifications = notifications.list_notifications(
        current_user.id,
        unread_only=True,
    )

    urgent = sum(
        1
        for request in [*assigned_recent, *created_recent, *pool_recent]
        if request.get("priority") == "urgent"
    )

    return {
        "counts": {
            "assigned": len(assigned_recent),
            "created": len(created_recent),
            "pool": len(pool_recent),
            "done": len(done_recent),
            "urgent": urgent,
        },
        "assigned_recent": assigned_recent,
        "created_recent": created_recent,
        "pool_recent": pool_recent,
        "notifications_unread": len(unread_notifications),
    }
