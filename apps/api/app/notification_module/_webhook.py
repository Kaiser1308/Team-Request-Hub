"""Internal: Telegram webhook /start command handling."""

import re
from datetime import datetime, timezone

from app.core.config import get_settings
from app.notification_module import _store, _telegram

START_COMMAND_PATTERN = re.compile(r"^/start(?:@\w+)?(?:\s+(.+))?$")


def handle_webhook(body: dict, secret_token: str | None) -> dict:
    """Process Telegram webhook update. Returns {"ok": bool}."""
    settings = get_settings()

    if settings.telegram_webhook_secret:
        if secret_token != settings.telegram_webhook_secret:
            return {"ok": False}

    message = body.get("message")
    if not message:
        return {"ok": True}

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    username = chat.get("username")
    text = message.get("text", "")

    match = START_COMMAND_PATTERN.match(text.strip())
    if not match:
        return {"ok": True}

    link_code = (match.group(1) or "").strip()
    if not link_code:
        if settings.telegram_bot_token and chat_id:
            _telegram.send_telegram_message(
                bot_token=settings.telegram_bot_token,
                chat_id=chat_id,
                text=(
                    "B\u1ea1n \u0111ang m\u1edf bot, nh\u01b0ng ch\u01b0a c\u00f3 m\u00e3 li\u00ean k\u1ebft.\n"
                    "Vui l\u00f2ng quay l\u1ea1i Team Request Hub, b\u1ea5m 'Li\u00ean k\u1ebft Telegram' r\u1ed3i m\u1edf l\u1ea1i link m\u1edbi."
                ),
            )
        return {"ok": True}

    now = datetime.now(timezone.utc).isoformat()
    token_record = _store.get_valid_link_token(link_code, now)

    if not token_record:
        if settings.telegram_bot_token and chat_id:
            _telegram.send_telegram_message(
                bot_token=settings.telegram_bot_token,
                chat_id=chat_id,
                text=(
                    "M\u00e3 li\u00ean k\u1ebft kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c \u0111\u00e3 h\u1ebft h\u1ea1n.\n"
                    "Vui l\u00f2ng quay l\u1ea1i Team Request Hub \u0111\u1ec3 t\u1ea1o li\u00ean k\u1ebft m\u1edbi."
                ),
            )
        return {"ok": True}

    _store.link_telegram_user(
        user_id=token_record["user_id"],
        chat_id=chat_id,
        username=username,
        linked_at=now,
    )
    _store.mark_link_token_used(token_record["id"], now)

    if settings.telegram_bot_token:
        _telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=chat_id,
            text=(
                "\u0110\u00e3 li\u00ean k\u1ebft Telegram v\u1edbi Team Request Hub.\n"
                "T\u1eeb gi\u1edd b\u1ea1n s\u1ebd nh\u1eadn th\u00f4ng b\u00e1o khi \u0111\u01b0\u1ee3c giao task."
            ),
        )

    return {"ok": True}
