from pydantic import BaseModel, EmailStr

from app.schemas.common import Role


class UserRoleUpdate(BaseModel):
    role: Role


class UserActiveUpdate(BaseModel):
    is_active: bool


class UserLanguageUpdate(BaseModel):
    language: str


class CurrentUser(BaseModel):
    id: str
    email: EmailStr | None = None
    name: str | None = None
    avatar_url: str | None = None
    role: Role
    is_active: bool = True


class UserOut(BaseModel):
    id: str
    email: EmailStr | None = None
    name: str | None = None
    avatar_url: str | None = None
    role: Role
    is_active: bool = True
    created_at: str | None = None
