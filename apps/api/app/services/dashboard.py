from app.core.permissions import is_lead
from app.repositories import request_repository
from app.schemas.users import CurrentUser
from app import notification_module
from app.services import request_service


def is_assigned_to_user(request: dict, user_id: str) -> bool:
    assignees = request.get("assignees") or []
    if any(assignee.get("id") == user_id for assignee in assignees if isinstance(assignee, dict)):
        return True
    return request.get("assigned_to") == user_id


def has_assignees(request: dict) -> bool:
    assignees = request.get("assignees") or []
    if assignees:
        return True
    return bool(request.get("assigned_to"))


def get_dashboard_summary(current_user: CurrentUser) -> dict:
    raw_requests = request_repository.get_dashboard_data(current_user.id)
    enriched = request_service.enrich_requests_with_users(raw_requests)

    assigned_recent = []
    created_recent = []
    pool_recent = []
    done_recent = []

    for request in enriched:
        status = request.get("status")
        created_by = request.get("created_by")
        is_assigned = is_assigned_to_user(request, current_user.id)

        if is_assigned and status != "done":
            assigned_recent.append(request)
        if created_by == current_user.id:
            created_recent.append(request)
        if not has_assignees(request) and status == "pending":
            pool_recent.append(request)
        if status == "done":
            if is_lead(current_user):
                done_recent.append(request)
            elif created_by == current_user.id or is_assigned:
                done_recent.append(request)

    urgent_ids = set()
    for request in assigned_recent + created_recent + pool_recent:
        if request.get("priority") == "urgent":
            urgent_ids.add(request.get("id"))

    unread_notifications = notification_module.list_notifications(
        current_user.id,
        unread_only=True,
    )

    return {
        "counts": {
            "assigned": len(assigned_recent),
            "created": len(created_recent),
            "pool": len(pool_recent),
            "done": len(done_recent),
            "urgent": len(urgent_ids),
        },
        "assigned_recent": assigned_recent[:10],
        "created_recent": created_recent[:10],
        "pool_recent": pool_recent[:10],
        "notifications_unread": len(unread_notifications),
    }
