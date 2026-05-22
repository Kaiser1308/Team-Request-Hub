import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel

from app.core.auth import get_current_user, require_active_current_user
from app.core.config import get_settings
from app.repositories import telegram_repository
from app.schemas.telegram import TelegramLinkOut, TelegramProfileOut
from app.schemas.users import CurrentUser
from app.services import telegram

router = APIRouter()


class WebhookMessage(BaseModel):
    message: dict | None = None


@router.get("/profile", response_model=TelegramProfileOut)
async def get_telegram_profile(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    profile = telegram_repository.get_user_telegram_profile(current_user.id)
    if not profile or not profile.get("telegram_chat_id"):
        return TelegramProfileOut(linked=False)
    return TelegramProfileOut(
        linked=True,
        username=profile.get("telegram_username"),
        linked_at=profile.get("telegram_linked_at"),
    )


@router.post("/link", response_model=TelegramLinkOut)
async def create_telegram_link(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    settings = get_settings()
    if not settings.telegram_bot_username:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram integration is not configured",
        )

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    telegram_repository.create_link_token(current_user.id, token, expires_at)
    url = f"https://t.me/{settings.telegram_bot_username}?start={token}"
    return TelegramLinkOut(url=url, expires_at=expires_at)


@router.delete("/link", response_model=TelegramProfileOut)
async def unlink_telegram(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    telegram_repository.unlink_telegram_user(current_user.id)
    return TelegramProfileOut(linked=False)


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
):
    settings = get_settings()

    if settings.telegram_webhook_secret:
        if x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
            return {"ok": False}

    body = await request.json()
    message = body.get("message")
    if not message:
        return {"ok": True}

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    username = chat.get("username")
    text = message.get("text", "")

    if not text.startswith("/start "):
        return {"ok": True}

    link_code = text[len("/start "):]
    now = datetime.now(timezone.utc).isoformat()
    token_record = telegram_repository.get_valid_link_token(link_code, now)

    if not token_record:
        if settings.telegram_bot_token and chat_id:
            telegram.send_telegram_message(
                bot_token=settings.telegram_bot_token,
                chat_id=chat_id,
                text=(
                    "Mã liên kết không hợp lệ hoặc đã hết hạn.\n"
                    "Vui lòng quay lại Team Request Hub để tạo liên kết mới."
                ),
            )
        return {"ok": True}

    telegram_repository.link_telegram_user(
        user_id=token_record["user_id"],
        chat_id=chat_id,
        username=username,
        linked_at=now,
    )
    telegram_repository.mark_link_token_used(token_record["id"], now)

    if settings.telegram_bot_token:
        telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=chat_id,
            text=(
                "Đã liên kết Telegram với Team Request Hub.\n"
                "Từ giờ bạn sẽ nhận thông báo khi được giao task."
            ),
        )

    return {"ok": True}
