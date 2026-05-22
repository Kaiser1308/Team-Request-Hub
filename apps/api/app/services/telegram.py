import httpx

PRIORITY_LABELS = {
    "low": "Thấp",
    "medium": "Trung bình",
    "high": "Cao",
    "urgent": "Khẩn cấp",
}

STATUS_LABELS = {
    "pending": "Đang chờ",
    "acknowledged": "Đã xác nhận",
    "in_progress": "Đang xử lý",
    "done": "Hoàn tất",
    "cancelled": "Đã hủy",
}


def build_assignment_message(request: dict, *, reassigned: bool, app_base_url: str) -> str:
    heading = "Bạn vừa được giao lại một task" if reassigned else "Bạn vừa được giao task mới"
    priority = PRIORITY_LABELS.get(request.get("priority"), request.get("priority", ""))
    status = STATUS_LABELS.get(request.get("status"), request.get("status", ""))
    return (
        f"{heading}\n\n"
        f"Tiêu đề: {request['title']}\n"
        f"Độ ưu tiên: {priority}\n"
        f"Trạng thái: {status}\n\n"
        f"Mở task: {app_base_url}/requests/{request['id']}"
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
