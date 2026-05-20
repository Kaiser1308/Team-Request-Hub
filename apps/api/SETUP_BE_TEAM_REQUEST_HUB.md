# BE Setup: Team Request Hub

## Architecture

```txt
FE      Next.js 15 + TypeScript + Tailwind + shadcn
BE      FastAPI Python
DB      Supabase PostgreSQL + Auth + Realtime
Deploy  FE → Vercel / BE → Railway hoặc Render
```

---

## Backend Responsibility

FastAPI backend là nơi giữ toàn bộ logic thật của hệ thống.

BE chịu trách nhiệm:

```txt
- Verify Supabase JWT
- Load current user
- Permission check
- Create request
- Assign / self-assign / reassign
- Update status
- Done + reply
- Cancel request
- Create notification records
- Create assignment history
- Create status logs
```

FE không xử lý business logic.

FE chỉ:

```txt
- Login Google bằng Supabase Auth
- Lấy JWT
- Gọi FastAPI bằng Bearer JWT
- Render UI
- Lắng nghe realtime notification/status sau này
```

---

## Product Scope

**Team Request Hub** là internal request workflow tool.

Request không còn API-specific. Request là flexible task.

Core request fields:

```txt
title
description
tags
priority
assigned_to
reference_links
status
reply
```

Tags dùng để phân loại task thay vì tạo schema cứng.

Ví dụ tags:

```txt
api
frontend
backend
bug
ui
data
database
auth
config
deployment
review
blocked
urgent
other
```

---

## Business Rules

```txt
1. Mọi role đều tạo request được.
2. Request có thể assign trực tiếp cho user hoặc để vào pool.
3. assigned_to = null nghĩa là request nằm trong pool.
4. Mọi role đều có thể self-assign request từ pool.
5. Creator có thể reassign request mình tạo nếu chưa done/cancelled.
6. Assignee có thể reassign request đang assigned cho mình.
7. Lead có thể reassign mọi request.
8. Reassign từ pending giữ status pending.
9. Reassign từ acknowledged/in_progress reset status về pending.
10. Reassign từ acknowledged/in_progress bắt buộc có reason.
11. Done bắt buộc có reply.
12. Cancelled chỉ creator hoặc lead được làm.
13. Mọi status transition phải ghi request_status_logs.
14. Mọi assignment/reassignment phải ghi assignment_history.
15. Reassign phải tạo notification cho người nhận mới và creator.
```

---

## Roles

```python
Role = Literal["fe", "be", "lead"]
```

Intern không có role riêng. Intern được map vào `fe` hoặc `be`.

---

## Status

```python
RequestStatus = Literal[
    "pending",
    "acknowledged",
    "in_progress",
    "done",
    "cancelled",
]
```

---

## Priority

```python
RequestPriority = Literal[
    "low",
    "medium",
    "high",
    "urgent",
]
```

---

## Step 1 — Create backend folder

Nếu dùng monorepo:

```txt
project-root/
├── frontend/
└── backend/
```

Nếu tách repo riêng thì chỉ cần tạo root backend.

Backend structure:

```txt
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── auth.py
│   │   └── permissions.py
│   ├── db/
│   │   └── supabase.py
│   ├── schemas/
│   │   ├── common.py
│   │   ├── users.py
│   │   ├── requests.py
│   │   └── notifications.py
│   ├── routes/
│   │   ├── health.py
│   │   ├── users.py
│   │   ├── requests.py
│   │   └── notifications.py
│   ├── services/
│   │   ├── users.py
│   │   ├── requests.py
│   │   ├── assignments.py
│   │   ├── status_logs.py
│   │   └── notifications.py
│   └── utils/
│       └── time.py
├── requirements.txt
├── .env
├── .env.example
└── README.md
```

---

## Step 2 — Install dependencies

### `requirements.txt`

```txt
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-dotenv
supabase
httpx
python-jose[cryptography]
```

Install:

```bash
pip install -r requirements.txt
```

Run dev server:

```bash
uvicorn app.main:app --reload --port 8000
```

---

## Step 3 — Env files

### `.env`

```env
APP_NAME=Team Request Hub API
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

### `.env.example`

```env
APP_NAME=
APP_ENV=
CORS_ORIGINS=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

Important:

```txt
SUPABASE_SERVICE_ROLE_KEY chỉ nằm ở backend.
Không đưa key này sang frontend.
```

---

## Step 4 — Config

### `app/core/config.py`

```python
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Team Request Hub API"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## Step 5 — Supabase client

### `app/db/supabase.py`

```python
from supabase import create_client, Client
from app.core.config import get_settings


def get_supabase_admin() -> Client:
    settings = get_settings()

    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
```

Backend dùng service role để query DB server-side.

Tất cả permission vẫn phải tự check trong FastAPI, không dựa vào FE.

---

## Step 6 — Auth guard

### `app/core/auth.py`

```python
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from app.core.config import get_settings
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> CurrentUser:
    token = credentials.credentials
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    supabase = get_supabase_admin()

    result = (
        supabase.table("users")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        )

    return CurrentUser(
        id=result.data["id"],
        email=result.data.get("email") or email,
        name=result.data.get("name"),
        avatar_url=result.data.get("avatar_url"),
        role=result.data["role"],
    )
```

Note:

```txt
Auth users nằm trong Supabase Auth.
App profile nên có bảng public.users hoặc app_users.
FastAPI load role từ bảng app profile này.
```

---

## Step 7 — Common schemas

### `app/schemas/common.py`

```python
from typing import Literal

Role = Literal["fe", "be", "lead"]

RequestStatus = Literal[
    "pending",
    "acknowledged",
    "in_progress",
    "done",
    "cancelled",
]

RequestPriority = Literal[
    "low",
    "medium",
    "high",
    "urgent",
]
```

---

## Step 8 — User schemas

### `app/schemas/users.py`

```python
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
```

If `EmailStr` causes missing dependency, install:

```bash
pip install email-validator
```

Alternative: use `str` for email to keep dependencies minimal.

---

## Step 9 — Request schemas

### `app/schemas/requests.py`

```python
from pydantic import BaseModel, Field
from app.schemas.common import RequestPriority, RequestStatus


class InternalRequestBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    priority: RequestPriority = "medium"
    assigned_to: str | None = None
    reference_links: list[str] = Field(default_factory=list)


class InternalRequestCreate(InternalRequestBase):
    pass


class InternalRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None
    priority: RequestPriority | None = None
    reference_links: list[str] | None = None


class AssignRequest(BaseModel):
    assigned_to: str
    reason: str | None = None


class ReassignRequest(BaseModel):
    assigned_to: str
    reason: str | None = None


class StatusUpdateRequest(BaseModel):
    status: RequestStatus
    reason: str | None = None


class DoneRequest(BaseModel):
    reply: str = Field(min_length=1)


class CancelRequest(BaseModel):
    reason: str | None = None


class InternalRequestOut(BaseModel):
    id: str
    title: str
    description: str
    tags: list[str]
    priority: RequestPriority
    status: RequestStatus
    created_by: str
    assigned_to: str | None = None
    reference_links: list[str]
    reply: str | None = None
    acknowledged_at: str | None = None
    started_at: str | None = None
    done_at: str | None = None
    cancelled_at: str | None = None
    created_at: str
    updated_at: str
```

---

## Step 10 — Notification schemas

### `app/schemas/notifications.py`

```python
from typing import Literal
from pydantic import BaseModel


NotificationType = Literal[
    "assigned",
    "reassigned",
    "status_changed",
    "pool_new",
    "replied",
    "done",
    "cancelled",
]


class NotificationOut(BaseModel):
    id: str
    user_id: str
    request_id: str | None = None
    type: NotificationType
    message: str
    is_read: bool
    created_at: str
```

---

## Step 11 — Permissions

### `app/core/permissions.py`

```python
from fastapi import HTTPException, status
from app.schemas.users import CurrentUser


def is_lead(user: CurrentUser) -> bool:
    return user.role == "lead"


def ensure_can_view_request(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    if request.get("assigned_to") == user.id:
        return

    if request.get("assigned_to") is None:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot view this request",
    )


def ensure_can_reassign(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    if request.get("assigned_to") == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot reassign this request",
    )


def ensure_can_cancel(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot cancel this request",
    )


def ensure_is_assignee_or_lead(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request.get("assigned_to") == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only assignee or lead can perform this action",
    )
```

---

## Step 12 — Main app

### `app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import health, users, requests, notifications

settings = get_settings()

app = FastAPI(title=settings.app_name)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(requests.router, prefix="/requests", tags=["requests"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
```

---

## Step 13 — Health route

### `app/routes/health.py`

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health_check():
    return {"status": "ok"}
```

---

## Step 14 — Users route

### `app/routes/users.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser, UserOut

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)]
):
    return current_user


@router.get("", response_model=list[UserOut])
async def list_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)]
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("users")
        .select("id,email,name,avatar_url,role,created_at")
        .order("name")
        .execute()
    )

    return result.data or []
```

---

## Step 15 — Request routes skeleton

### `app/routes/requests.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.permissions import (
    ensure_can_view_request,
    ensure_can_reassign,
    ensure_can_cancel,
    ensure_is_assignee_or_lead,
)
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser
from app.schemas.requests import (
    InternalRequestCreate,
    InternalRequestUpdate,
    InternalRequestOut,
    ReassignRequest,
    StatusUpdateRequest,
    DoneRequest,
    CancelRequest,
)

router = APIRouter()


def get_request_or_404(request_id: str) -> dict:
    supabase = get_supabase_admin()

    result = (
        supabase.table("internal_requests")
        .select("*")
        .eq("id", request_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    return result.data


@router.get("", response_model=list[InternalRequestOut])
async def list_requests(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    view: str = "assigned",
):
    supabase = get_supabase_admin()
    query = supabase.table("internal_requests").select("*")

    if view == "assigned":
        query = query.eq("assigned_to", current_user.id)
    elif view == "created":
        query = query.eq("created_by", current_user.id)
    elif view == "pool":
        query = query.is_("assigned_to", "null")
    elif view == "done":
        query = query.eq("status", "done")
    elif view == "all":
        if current_user.role != "lead":
            raise HTTPException(status_code=403, detail="Lead only")
    else:
        raise HTTPException(status_code=400, detail="Invalid view")

    result = query.order("created_at", desc=True).execute()
    return result.data or []


@router.post("", response_model=InternalRequestOut)
async def create_request(
    payload: InternalRequestCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()

    data = {
        "title": payload.title,
        "description": payload.description,
        "tags": payload.tags,
        "priority": payload.priority,
        "assigned_to": payload.assigned_to,
        "reference_links": payload.reference_links,
        "status": "pending",
        "created_by": current_user.id,
    }

    result = (
        supabase.table("internal_requests")
        .insert(data)
        .execute()
    )

    created = result.data[0]

    # TODO: create assignment_history if assigned_to exists
    # TODO: create notification for assignee or pool_new

    return created


@router.get("/{request_id}", response_model=InternalRequestOut)
async def get_request_detail(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    return request


@router.patch("/{request_id}", response_model=InternalRequestOut)
async def update_request(
    request_id: str,
    payload: InternalRequestUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)

    if current_user.role != "lead" and request["created_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator or lead can edit")

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot edit closed request")

    update_data = payload.model_dump(exclude_unset=True)

    supabase = get_supabase_admin()
    result = (
        supabase.table("internal_requests")
        .update(update_data)
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]


@router.post("/{request_id}/self-assign", response_model=InternalRequestOut)
async def self_assign_request(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)

    if request.get("assigned_to") is not None:
        raise HTTPException(status_code=400, detail="Request already assigned")

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot assign closed request")

    supabase = get_supabase_admin()

    result = (
        supabase.table("internal_requests")
        .update({"assigned_to": current_user.id, "status": "pending"})
        .eq("id", request_id)
        .execute()
    )

    # TODO: insert assignment_history
    # TODO: notify creator

    return result.data[0]


@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_reassign(current_user, request)

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot reassign closed request")

    if request["status"] in ["acknowledged", "in_progress"] and not payload.reason:
        raise HTTPException(
            status_code=400,
            detail="Reason is required when reassigning acknowledged or in-progress request",
        )

    next_status = "pending"

    supabase = get_supabase_admin()

    result = (
        supabase.table("internal_requests")
        .update({
            "assigned_to": payload.assigned_to,
            "status": next_status,
            "acknowledged_at": None,
            "started_at": None,
        })
        .eq("id", request_id)
        .execute()
    )

    # TODO: insert assignment_history with from_user_id, to_user_id, assigned_by, reason
    # TODO: insert status log if status changed
    # TODO: notify new assignee
    # TODO: notify creator

    return result.data[0]


@router.post("/{request_id}/status", response_model=InternalRequestOut)
async def update_status(
    request_id: str,
    payload: StatusUpdateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_is_assignee_or_lead(current_user, request)

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Request already closed")

    if payload.status == "done":
        raise HTTPException(status_code=400, detail="Use /done endpoint")

    allowed = {
        "pending": ["acknowledged", "cancelled"],
        "acknowledged": ["in_progress", "cancelled"],
        "in_progress": ["acknowledged", "cancelled"],
    }

    if payload.status not in allowed.get(request["status"], []):
        raise HTTPException(status_code=400, detail="Invalid status transition")

    update_data = {"status": payload.status}

    if payload.status == "acknowledged":
        update_data["acknowledged_at"] = "now()"
    elif payload.status == "in_progress":
        update_data["started_at"] = "now()"

    supabase = get_supabase_admin()
    result = (
        supabase.table("internal_requests")
        .update(update_data)
        .eq("id", request_id)
        .execute()
    )

    # TODO: insert status log
    # TODO: notify creator

    return result.data[0]


@router.post("/{request_id}/done", response_model=InternalRequestOut)
async def mark_done(
    request_id: str,
    payload: DoneRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_is_assignee_or_lead(current_user, request)

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Request already closed")

    supabase = get_supabase_admin()

    result = (
        supabase.table("internal_requests")
        .update({
            "status": "done",
            "reply": payload.reply,
            "done_at": "now()",
        })
        .eq("id", request_id)
        .execute()
    )

    # TODO: insert status log
    # TODO: notify creator

    return result.data[0]


@router.post("/{request_id}/cancel", response_model=InternalRequestOut)
async def cancel_request(
    request_id: str,
    payload: CancelRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_cancel(current_user, request)

    if request["status"] in ["done", "cancelled"]:
        raise HTTPException(status_code=400, detail="Request already closed")

    supabase = get_supabase_admin()

    result = (
        supabase.table("internal_requests")
        .update({
            "status": "cancelled",
            "cancelled_at": "now()",
        })
        .eq("id", request_id)
        .execute()
    )

    # TODO: insert status log
    # TODO: notify assignee if exists

    return result.data[0]
```

Important note:

```txt
Supabase Python update with "now()" may not evaluate as SQL function depending on client behavior.
If it stores literal string "now()", replace with Python datetime UTC string from app/utils/time.py.
```

---

## Step 16 — Notification routes skeleton

### `app/routes/notifications.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser
from app.schemas.notifications import NotificationOut

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)]
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)]
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", current_user.id)
        .execute()
    )

    return result.data[0]
```

---

## Step 17 — Time utility

### `app/utils/time.py`

```python
from datetime import datetime, timezone


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
```

Recommended:

```txt
Use utc_now_iso() instead of passing "now()" through Supabase Python client.
```

---

## Step 18 — Check

Run:

```bash
uvicorn app.main:app --reload --port 8000
```

Expected:

```txt
GET http://localhost:8000/health
→ {"status": "ok"}
```

Open docs:

```txt
http://localhost:8000/docs
```

---

## Step 19 — Constraints

```txt
- Do not put Supabase service role key in frontend.
- Do not trust role from frontend.
- Always load current user from backend DB using JWT sub.
- All permission checks happen in FastAPI.
- All status transition checks happen in FastAPI.
- Done requires reply.
- Reassign must create assignment history.
- Status changes must create status logs.
- Notification records are created by backend.
```

---

## Expected Output

```txt
Created:
- backend/app/main.py
- backend/app/core/config.py
- backend/app/core/auth.py
- backend/app/core/permissions.py
- backend/app/db/supabase.py
- backend/app/schemas/common.py
- backend/app/schemas/users.py
- backend/app/schemas/requests.py
- backend/app/schemas/notifications.py
- backend/app/routes/health.py
- backend/app/routes/users.py
- backend/app/routes/requests.py
- backend/app/routes/notifications.py
- backend/app/services/users.py
- backend/app/services/requests.py
- backend/app/services/assignments.py
- backend/app/services/status_logs.py
- backend/app/services/notifications.py
- backend/app/utils/time.py
- backend/requirements.txt
- backend/.env.example
- backend/README.md
```

---

## Next Step After BE Setup

```txt
1. Viết BUSINESS_RULES.md
2. Viết API_CONTRACT.md
3. Viết DB_SCHEMA.sql nếu chưa có hoặc update theo InternalRequest
4. Sau đó mới build UI wireframe
```
