# Root Backend Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Team Request Hub FastAPI backend directly at the repository root.

**Architecture:** The backend is a FastAPI application rooted at `app.main:app`. Routes are separated from schemas, auth, permission helpers, Supabase client creation, and time utilities. Service modules are placeholder modules for future business-rule persistence once the database schema is finalized.

**Tech Stack:** Python, FastAPI, Pydantic, pydantic-settings, Supabase Python client, python-jose, Uvicorn.

---

## File Structure

- Create: `app/__init__.py` for package discovery.
- Create: `app/main.py` for FastAPI app, CORS, and router registration.
- Create: `app/core/config.py` for environment-backed settings.
- Create: `app/core/auth.py` for Supabase JWT verification and current-user loading.
- Create: `app/core/permissions.py` for request authorization helpers.
- Create: `app/db/supabase.py` for the service-role Supabase client factory.
- Create: `app/schemas/common.py` for shared literals.
- Create: `app/schemas/users.py` for current user and user output schemas.
- Create: `app/schemas/requests.py` for request input and output schemas.
- Create: `app/schemas/notifications.py` for notification output schemas.
- Create: `app/routes/health.py` for unauthenticated health checks.
- Create: `app/routes/users.py` for current-user and user-list endpoints.
- Create: `app/routes/requests.py` for request workflow endpoints.
- Create: `app/routes/notifications.py` for notification endpoints.
- Create: `app/services/users.py`, `app/services/requests.py`, `app/services/assignments.py`, `app/services/status_logs.py`, `app/services/notifications.py` as empty modules with docstrings.
- Create: `app/utils/time.py` for UTC ISO timestamp generation.
- Create: `requirements.txt` with runtime dependencies.
- Create: `.env.example` with required environment variable names only.
- Create: `README.md` with setup and run instructions.

---

### Task 1: Add Dependencies And Environment Template

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create runtime dependency list**

Create `requirements.txt`:

```txt
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-dotenv
supabase
httpx
python-jose[cryptography]
email-validator
```

- [ ] **Step 2: Create environment template**

Create `.env.example`:

```env
APP_NAME=Team Request Hub API
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

- [ ] **Step 3: Create README**

Create `README.md`:

```markdown
# Team Request Hub API

FastAPI backend for Team Request Hub.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env` with Supabase backend credentials. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```txt
GET http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

API docs:

```txt
http://localhost:8000/docs
```
```

- [ ] **Step 4: Verify files exist**

Run: `test -f requirements.txt && test -f .env.example && test -f README.md`
Expected: command exits with status `0`.

---

### Task 2: Add Core Configuration, Supabase Client, Schemas, And Utilities

**Files:**
- Create: `app/__init__.py`
- Create: `app/core/__init__.py`
- Create: `app/core/config.py`
- Create: `app/db/__init__.py`
- Create: `app/db/supabase.py`
- Create: `app/schemas/__init__.py`
- Create: `app/schemas/common.py`
- Create: `app/schemas/users.py`
- Create: `app/schemas/requests.py`
- Create: `app/schemas/notifications.py`
- Create: `app/utils/__init__.py`
- Create: `app/utils/time.py`

- [ ] **Step 1: Create package marker files**

Create empty files:

```txt
app/__init__.py
app/core/__init__.py
app/db/__init__.py
app/schemas/__init__.py
app/utils/__init__.py
```

- [ ] **Step 2: Create settings module**

Create `app/core/config.py`:

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

- [ ] **Step 3: Create Supabase admin client factory**

Create `app/db/supabase.py`:

```python
from supabase import Client, create_client

from app.core.config import get_settings


def get_supabase_admin() -> Client:
    settings = get_settings()

    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
```

- [ ] **Step 4: Create shared schemas**

Create `app/schemas/common.py`:

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

- [ ] **Step 5: Create user schemas**

Create `app/schemas/users.py`:

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

- [ ] **Step 6: Create request schemas**

Create `app/schemas/requests.py`:

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

- [ ] **Step 7: Create notification schemas**

Create `app/schemas/notifications.py`:

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

- [ ] **Step 8: Create time utility**

Create `app/utils/time.py`:

```python
from datetime import datetime, timezone


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
```

- [ ] **Step 9: Verify imports**

Run: `python -m compileall app`
Expected: command exits with status `0`.

---

### Task 3: Add Auth And Permission Helpers

**Files:**
- Create: `app/core/auth.py`
- Create: `app/core/permissions.py`

- [ ] **Step 1: Create auth guard**

Create `app/core/auth.py`:

```python
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
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
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

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

- [ ] **Step 2: Create permission helpers**

Create `app/core/permissions.py`:

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

- [ ] **Step 3: Verify imports**

Run: `python -m compileall app`
Expected: command exits with status `0`.

---

### Task 4: Add Routes And Main App

**Files:**
- Create: `app/routes/__init__.py`
- Create: `app/routes/health.py`
- Create: `app/routes/users.py`
- Create: `app/routes/requests.py`
- Create: `app/routes/notifications.py`
- Create: `app/main.py`

- [ ] **Step 1: Create route package marker**

Create empty file: `app/routes/__init__.py`.

- [ ] **Step 2: Create health route**

Create `app/routes/health.py`:

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health_check():
    return {"status": "ok"}
```

- [ ] **Step 3: Create users route**

Create `app/routes/users.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser, UserOut

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return current_user


@router.get("", response_model=list[UserOut])
async def list_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
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

- [ ] **Step 4: Create requests route**

Create `app/routes/requests.py` with the workflow endpoints from the setup guide, using `utc_now_iso()` for `acknowledged_at`, `started_at`, `done_at`, and `cancelled_at` updates.

- [ ] **Step 5: Create notifications route**

Create `app/routes/notifications.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.notifications import NotificationOut
from app.schemas.users import CurrentUser

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", current_user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return result.data[0]
```

- [ ] **Step 6: Create FastAPI app**

Create `app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import health, notifications, requests, users

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

- [ ] **Step 7: Verify imports with environment variables**

Run: `APP_NAME='Team Request Hub API' APP_ENV=development CORS_ORIGINS=http://localhost:3000 SUPABASE_URL=https://example.supabase.co SUPABASE_ANON_KEY=anon SUPABASE_SERVICE_ROLE_KEY=service SUPABASE_JWT_SECRET=secret python -c "from app.main import app; print(app.title)"`
Expected output contains: `Team Request Hub API`.

---

### Task 5: Add Service Placeholder Modules And Final Verification

**Files:**
- Create: `app/services/__init__.py`
- Create: `app/services/users.py`
- Create: `app/services/requests.py`
- Create: `app/services/assignments.py`
- Create: `app/services/status_logs.py`
- Create: `app/services/notifications.py`

- [ ] **Step 1: Create service modules**

Create `app/services/__init__.py` as an empty file.

Create each service file with a module docstring:

```python
"""Service helpers for future database-backed business logic."""
```

- [ ] **Step 2: Compile all Python files**

Run: `python -m compileall app`
Expected: command exits with status `0`.

- [ ] **Step 3: Import app with sample environment**

Run: `APP_NAME='Team Request Hub API' APP_ENV=development CORS_ORIGINS=http://localhost:3000 SUPABASE_URL=https://example.supabase.co SUPABASE_ANON_KEY=anon SUPABASE_SERVICE_ROLE_KEY=service SUPABASE_JWT_SECRET=secret python -c "from app.main import app; print([route.path for route in app.routes])"`
Expected output includes `/health`, `/users/me`, `/requests`, and `/notifications`.

- [ ] **Step 4: Review git diff**

Run: `git diff -- app requirements.txt .env.example README.md docs/superpowers`
Expected: diff only contains backend scaffold, design doc, and implementation plan.

---

## Self-Review

- Spec coverage: The plan creates the root backend structure, configuration, Supabase client, auth guard, schemas, permissions, routes, service placeholders, time utility, dependencies, env template, and README.
- Placeholder scan: Service modules are intentionally placeholders because the spec says persistence helpers come after DB schema finalization. Route TODO comments from the source setup are acceptable scaffold markers for later business-rule persistence.
- Type consistency: Schema names, route imports, and helper names match the setup guide and design document.
