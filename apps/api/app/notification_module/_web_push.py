"""Internal: Web Push payload building and sending."""

import json

from pywebpush import webpush


def build_web_push_payload(
    request: dict,
    *,
    notification_id: str,
    reassigned: bool,
    app_base_url: str,
    lang: str = "vi",
) -> dict:
    is_vi = lang != "en"
    title = (
        "Bạn vừa được giao lại request" if reassigned and is_vi
        else "Bạn vừa được giao request mới" if is_vi
        else "You have been reassigned a request" if reassigned
        else "You have been assigned a request"
    )
    return {
        "title": title,
        "body": request["title"],
        "url": f"{app_base_url}/requests/{request['id']}",
        "tag": notification_id,
    }


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    vapid_private_key: str,
    vapid_subject: str,
    payload: dict,
) -> None:
    subscription = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=vapid_private_key,
        vapid_claims={"sub": vapid_subject},
    )
