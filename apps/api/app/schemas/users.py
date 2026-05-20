from pydantic import BaseModel, EmailStr

from app.schemas.common import Role


class CurrentUser(BaseModel):
    id: str
    email: EmailStr | None = None
    name: str | None = None
    avatar_url: str | None = None
    role: Role


class UserOut(BaseModel):
    id: str
    email: EmailStr | None = None
    name: str | None = None
    avatar_url: str | None = None
    role: Role
    created_at: str | None = None
