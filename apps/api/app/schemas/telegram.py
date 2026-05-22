from pydantic import BaseModel


class TelegramLinkOut(BaseModel):
    url: str
    expires_at: str


class TelegramProfileOut(BaseModel):
    linked: bool
    username: str | None = None
    linked_at: str | None = None
