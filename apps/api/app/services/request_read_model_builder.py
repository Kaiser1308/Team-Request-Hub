from app.repositories import request_assignee_repository, request_attachment_repository, user_repository


def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    request_ids = [request["id"] for request in requests if request.get("id")]
    try:
        assignee_ids_by_request = request_assignee_repository.list_assignee_ids_by_request_ids(
            request_ids
        )
    except Exception:
        assignee_ids_by_request = {
            request.get("id"): ([request.get("assigned_to")] if request.get("assigned_to") else [])
            for request in requests
            if request.get("id")
        }

    try:
        attachments_by_request = _group_attachments(request_ids)
    except Exception:
        attachments_by_request = {}

    user_ids: list[str] = []
    for request in requests:
        if request.get("created_by"):
            user_ids.append(request["created_by"])
        user_ids.extend(assignee_ids_by_request.get(request.get("id"), []))
        if request.get("assigned_to"):
            user_ids.append(request["assigned_to"])

    users_by_id = user_repository.list_user_summaries(user_ids)
    enriched = []
    for request in requests:
        item = dict(request)
        assignee_ids = assignee_ids_by_request.get(request.get("id"), [])
        assignees = [users_by_id[user_id] for user_id in assignee_ids if user_id in users_by_id]
        fallback_assignee = users_by_id.get(request.get("assigned_to"))
        item["creator"] = users_by_id.get(request.get("created_by"))
        item["assignees"] = assignees
        item["assignee"] = assignees[0] if assignees else fallback_assignee
        item["assigned_to"] = assignee_ids[0] if assignee_ids else request.get("assigned_to")
        item["assignee_ids"] = assignee_ids
        item["attachments"] = attachments_by_request.get(request.get("id"), {"request": [], "done_reply": []})
        enriched.append(item)
    return enriched


def _group_attachments(request_ids: list[str]) -> dict:
    all_attachments = request_attachment_repository.list_by_request_ids(request_ids)
    grouped: dict[str, dict[str, list]] = {}
    for att in all_attachments:
        rid = att.get("request_id")
        ctx = att.get("context", "request")
        if rid not in grouped:
            grouped[rid] = {"request": [], "done_reply": []}
        grouped[rid][ctx].append(att)
    return grouped


def enrich_request_with_users(request: dict) -> dict:
    return enrich_requests_with_users([request])[0]
