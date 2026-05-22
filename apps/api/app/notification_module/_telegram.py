"""Internal: Telegram message building and sending."""

import httpx

PRIORITY_LABELS = {
    "en": {
        "low": "Low",
        "medium": "Medium",
        "high": "High",
        "urgent": "Urgent",
    },
    "vi": {
        "low": "Thấp",
        "medium": "Trung bình",
        "high": "Cao",
        "urgent": "Khẩn cấp",
    },
}

STATUS_LABELS = {
    "en": {
        "pending": "Pending",
        "acknowledged": "Acknowledged",
        "in_progress": "In progress",
        "done": "Done",
        "cancelled": "Cancelled",
    },
    "vi": {
        "pending": "Đang chờ",
        "acknowledged": "Đã xác nhận",
        "in_progress": "Đang xử lý",
        "done": "Hoàn tất",
        "cancelled": "Đã hủy",
    },
}

HEADING_LABELS = {
    "en": {
        "assigned": "You have been assigned a new task",
        "reassigned": "You have been reassigned a task",
    },
    "vi": {
        "assigned": "Bạn vừa được giao task mới",
        "reassigned": "Bạn vừa được giao lại một task",
    },
}

FIELD_LABELS = {
    "en": {"title": "Title", "priority": "Priority", "status": "Status", "openTask": "Open task"},
    "vi": {"title": "Tiêu đề", "priority": "Độ ưu tiên", "status": "Trạng thái", "openTask": "Mở task"},
}


def build_assignment_message(request: dict, *, reassigned: bool, app_base_url: str, lang: str = "vi") -> str:
    labels = "vi" if lang not in ("en", "vi") else lang
    priority_map = PRIORITY_LABELS[labels]
    status_map = STATUS_LABELS[labels]
    field = FIELD_LABELS[labels]
    heading_key = "reassigned" if reassigned else "assigned"
    heading = HEADING_LABELS[labels][heading_key]
    priority = priority_map.get(request.get("priority"), request.get("priority", ""))
    status = status_map.get(request.get("status"), request.get("status", ""))
    return (
        f"{heading}\n\n"
        f"{field['title']}: {request['title']}\n"
        f"{field['priority']}: {priority}\n"
        f"{field['status']}: {status}\n\n"
        f"{field['openTask']}: {app_base_url}/requests/{request['id']}"
    )


def send_telegram_message(*, bot_token: str, chat_id: str, text: str) -> str | None:
    response = httpx.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    message_id = payload.get("result", {}).get("message_id")
    return str(message_id) if message_id is not None else None
