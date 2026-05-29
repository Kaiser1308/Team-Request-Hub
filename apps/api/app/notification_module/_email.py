"""Internal: Email message building and SMTP sending."""

import smtplib
from email.message import EmailMessage


HEADINGS = {
    "en": {
        "assigned": "You have been assigned a request",
        "reassigned": "You have been reassigned a request",
    },
    "vi": {
        "assigned": "Bạn vừa được giao request mới",
        "reassigned": "Bạn vừa được giao lại một request",
    },
}


def build_assignment_email(request: dict, *, reassigned: bool, app_base_url: str, lang: str = "vi") -> dict:
    labels = "vi" if lang not in ("en", "vi") else lang
    key = "reassigned" if reassigned else "assigned"
    subject = HEADINGS[labels][key]
    url = f"{app_base_url}/requests/{request['id']}"
    text = (
        f"{subject}\n\n"
        f"Title: {request['title']}\n"
        f"Priority: {request.get('priority', '')}\n"
        f"Status: {request.get('status', '')}\n\n"
        f"Open request: {url}"
    )
    return {"subject": subject, "text": text}


def send_email(
    *,
    host: str,
    port: int,
    username: str | None,
    password: str | None,
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    text: str,
) -> str | None:
    message = EmailMessage()
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)

    with smtplib.SMTP(host, port, timeout=10) as smtp:
        smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
    return None
