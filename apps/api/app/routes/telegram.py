import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request

from app.core.auth import get_current_user, require_active_current_user
from app.core.config import get_settings
from app.schemas.telegram import TelegramLinkOut, TelegramProfileOut
from app.schemas.users import CurrentUser
from app import notification_module

router = APIRouter()


@router.get("/profile", response_model=TelegramProfileOut)
async def get_telegram_profile(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    profile = notification_module.get_telegram_profile(current_user.id)
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
    notification_module.create_link_token(current_user.id, token, expires_at)
    url = f"https://t.me/{settings.telegram_bot_username}?start={token}"
    return TelegramLinkOut(url=url, expires_at=expires_at)


@router.delete("/link", response_model=TelegramProfileOut)
async def unlink_telegram(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    notification_module.unlink_telegram(current_user.id)
    return TelegramProfileOut(linked=False)


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
):
    body = await request.json()
    return notification_module.handle_webhook(body, x_telegram_bot_api_secret_token)
