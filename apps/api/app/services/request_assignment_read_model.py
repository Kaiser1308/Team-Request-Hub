from app.repositories import request_assignee_repository


def assignee_ids_from_request(request: dict) -> list[str]:
    assignee_ids = request.get("assignee_ids") or []
    if assignee_ids:
        return list(assignee_ids)

    assignees = request.get("assignees") or []
    extracted = [
        assignee["id"]
        for assignee in assignees
        if isinstance(assignee, dict) and assignee.get("id")
    ]
    if extracted:
        return extracted

    assigned_to = request.get("assigned_to")
    if assigned_to:
        return [assigned_to]

    return []


def normalize_request_assignments(request: dict) -> dict:
    normalized = dict(request)
    normalized["assignee_ids"] = assignee_ids_from_request(request)
    return normalized


def is_assigned_to_user(request: dict, user_id: str) -> bool:
    return user_id in assignee_ids_from_request(request)


def has_current_assignees(request: dict) -> bool:
    return bool(assignee_ids_from_request(request))


def get_assignee_ids(request_id: str) -> list[str]:
    return request_assignee_repository.list_assignee_ids(request_id)


def get_assignee_ids_by_request_ids(requests: list[dict]) -> dict[str, list[str]]:
    request_ids = [r["id"] for r in requests]
    repo_map = request_assignee_repository.list_assignee_ids_by_request_ids(request_ids)

    result: dict[str, list[str]] = {}
    for request in requests:
        rid = request["id"]
        repo_ids = repo_map.get(rid, [])
        if repo_ids:
            result[rid] = repo_ids
        else:
            result[rid] = assignee_ids_from_request(request)
    return result
