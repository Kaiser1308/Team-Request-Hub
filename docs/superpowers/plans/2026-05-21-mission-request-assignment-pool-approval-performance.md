# Mission Request Assignment, Pool, Approval, And Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the current `mission.md` requirements: assign-on-create with user dropdowns, readable assignee display and reassign selection, pool visibility for all roles, measurable performance diagnosis, and signup/login with lead approval before app access.

**Architecture:** Keep backend workflow authority in FastAPI and Supabase service-role repositories. Keep frontend business calls inside `src/lib/api/*` and TanStack Query hooks, with UI components consuming typed data only. User approval is modeled through the existing `users.is_active` column: new signups become inactive, `/users/me` can reveal pending state, and all protected business endpoints reject inactive users.

**Tech Stack:** FastAPI, Supabase PostgreSQL/Auth, Pydantic, unittest, Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, TanStack Query v5, Supabase SSR/browser client.

---

## Requirements From `mission.md`

```txt
1. Add assign request to someone. Use a dropdown to choose the user. Reassign must also choose or show the person instead of raw id.
2. Other roles must also have Pool so they can see and take tasks.
3. App response is slow; determine whether WSL/runtime environment is involved.
4. Home page must have login/register. After registration, lead must approve before the user can enter.
```

## Files And Responsibilities

Backend:

- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql` - change new auth profiles to `is_active = false`, and document how to migrate existing projects.
- Modify: `docs/database-schema.md` - explain lead approval behavior.
- Modify: `docs/permissions.md` - document inactive pending users and pool visibility for all roles.
- Modify: `apps/api/app/schemas/users.py` - include `is_active` in user schemas and add an active-state update payload.
- Modify: `apps/api/app/core/auth.py` - return current user active status and add a dependency/helper that rejects inactive users for business endpoints.
- Modify: `apps/api/app/routes/users.py` - allow `/users/me` for pending users; require active users for `/users`, `/users/active`, `/users/{user_id}/role`, and `/users/{user_id}/active`; add lead approval endpoint.
- Modify: `apps/api/app/services/users.py` - implement lead-only approval and active-user listing helpers.
- Modify: `apps/api/app/repositories/user_repository.py` - select `is_active`, filter assignable users, update active state.
- Modify: `apps/api/app/routes/requests.py` - require active user on request workflow endpoints.
- Test: `apps/api/tests/test_auth.py`, `apps/api/tests/test_user_service_roles.py`, `apps/api/tests/test_users_routes.py`, `apps/api/tests/test_request_service_workflow.py`.

Frontend:

- Modify: `apps/web/src/types/index.ts` - add `is_active` to user/current user types.
- Modify: `apps/web/src/lib/api/users.ts` - add assignable users and approval API functions.
- Modify: `apps/web/src/hooks/use-users.ts` - add hooks for assignable users and lead approval mutation.
- Modify: `apps/web/src/lib/api/query-keys.ts` - add query keys for assignable users.
- Modify: `apps/web/src/components/requests/request-form.tsx` - add optional assignee dropdown.
- Modify: `apps/web/src/components/requests/reassign-dialog.tsx` - replace raw ID input with user dropdown.
- Modify: `apps/web/src/components/requests/request-card.tsx` - show assignee name/email instead of only “Assigned”.
- Modify: `apps/web/src/components/requests/request-detail.tsx` - show assignee name/email instead of raw ID.
- Modify: `apps/web/src/components/requests/request-timeline.tsx` - show assignment actor names when available.
- Modify: `apps/web/src/components/app/app-shell.tsx` - show Pool nav to all roles and handle inactive pending users cleanly.
- Modify: `apps/web/src/app/page.tsx` - replace redirect with public home page containing login/register calls to action.
- Modify: `apps/web/src/app/(auth)/login/page.tsx` - support login and registration mode.
- Create: `apps/web/src/app/(auth)/pending-approval/page.tsx` - pending approval screen.
- Create: `apps/web/src/components/auth/auth-form.tsx` - email/password login/register UI using Supabase Auth.
- Test by build/lint and browser smoke.

Performance:

- Create: `docs/performance-diagnosis.md` - record local measurements and conclusion about WSL vs app/API/Supabase latency.
- No code optimization should be done until measurements identify a bottleneck.

Required agent discipline:

- Before editing any existing function/class/method, run the project-required impact analysis if GitNexus tools are available. If GitNexus MCP is unavailable in the session, note that in the task log and continue with direct source inspection.
- Before committing, run `gitnexus_detect_changes()` if GitNexus tools are available. If unavailable, run `rtk git diff --stat` and inspect changed files manually.

---

## Task 1: Backend Approval Gate

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`
- Modify: `docs/permissions.md`
- Modify: `apps/api/app/schemas/users.py`
- Modify: `apps/api/app/core/auth.py`
- Modify: `apps/api/app/routes/users.py`
- Modify: `apps/api/app/services/users.py`
- Modify: `apps/api/app/repositories/user_repository.py`
- Test: `apps/api/tests/test_auth.py`
- Test: `apps/api/tests/test_user_service_roles.py`
- Test: `apps/api/tests/test_users_routes.py`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for these symbols before edits if available:

```txt
get_current_user
CurrentUser
UserOut
list_users
update_user_role
get_user_or_404
ensure_active_user
```

Report direct callers and risk level in the agent progress notes. If GitNexus is unavailable, record:

```txt
GitNexus MCP unavailable in this session; direct source inspection used instead.
```

- [ ] **Step 2: Write backend tests for inactive current user visibility and business rejection**

Add tests in `apps/api/tests/test_auth.py` that verify:

```python
def test_get_current_user_returns_inactive_profile():
    # Mock Supabase auth.get_user and users table result with is_active=False.
    # Expected: get_current_user returns CurrentUser(..., is_active=False)

def test_require_active_current_user_rejects_inactive_user():
    # Call the active-user guard with CurrentUser(is_active=False).
    # Expected: HTTPException 403 with detail "Your account is pending lead approval"
```

Use the existing test style in `apps/api/tests/test_auth.py`; do not introduce pytest-only fixtures because backend tests currently use unittest.

- [ ] **Step 3: Write backend tests for lead approval**

Add tests in `apps/api/tests/test_user_service_roles.py`:

```python
def test_lead_can_update_user_active_state(self):
    current_user = CurrentUser(
        id="lead-1",
        email="lead@example.com",
        name="Lead",
        role="lead",
        is_active=True,
    )
    payload = UserActiveUpdate(is_active=True)

    with patch("app.services.users.user_repository.update_user_active_state", return_value={"id": "user-1", "is_active": True}) as update:
        result = users.update_user_active_state("user-1", payload, current_user)

    self.assertTrue(result["is_active"])
    update.assert_called_once_with("user-1", True)

def test_non_lead_cannot_update_user_active_state(self):
    current_user = CurrentUser(
        id="fe-1",
        email="fe@example.com",
        name="FE",
        role="fe",
        is_active=True,
    )

    with self.assertRaises(HTTPException) as context:
        users.update_user_active_state("user-1", UserActiveUpdate(is_active=True), current_user)

    self.assertEqual(context.exception.status_code, 403)
```

- [ ] **Step 4: Run tests and confirm failure**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest tests.test_auth tests.test_user_service_roles"
```

Expected: FAIL because `CurrentUser.is_active`, `UserActiveUpdate`, active guard, and repository update do not exist yet.

- [ ] **Step 5: Update schemas**

In `apps/api/app/schemas/users.py`, add active fields:

```python
class UserActiveUpdate(BaseModel):
    is_active: bool


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
```

- [ ] **Step 6: Update auth guard**

In `apps/api/app/core/auth.py`, make `get_current_user` include `is_active`, then add:

```python
def require_active_current_user(current_user: CurrentUser) -> CurrentUser:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending lead approval",
        )
    return current_user
```

Use this guard as a service-level helper or route dependency in later tasks. Keep `/users/me` able to return inactive users so the frontend can show the pending approval page.

- [ ] **Step 7: Update user repository**

In `apps/api/app/repositories/user_repository.py`:

- Include `is_active` in all `select(...)` calls returning users.
- Add active-only list for assignment dropdowns:

```python
def list_active_users() -> list[dict]:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url,role,is_active,created_at")
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    return result.data or []
```

- Add lead approval update:

```python
def update_user_active_state(user_id: str, is_active: bool) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update({"is_active": is_active})
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return result.data[0]
```

- [ ] **Step 8: Update user service and routes**

In `apps/api/app/services/users.py`, add:

```python
def list_active_users() -> list[dict]:
    return user_repository.list_active_users()


def update_user_active_state(
    user_id: str,
    payload: UserActiveUpdate,
    current_user: CurrentUser,
) -> dict:
    if current_user.role != "lead":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only leads can approve users",
        )

    return user_repository.update_user_active_state(user_id, payload.is_active)
```

In `apps/api/app/routes/users.py`, add:

```python
@router.get("/active", response_model=list[UserOut])
async def list_active_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.list_active_users()


@router.patch("/{user_id}/active", response_model=UserOut)
async def update_user_active_state(
    user_id: str,
    payload: UserActiveUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.update_user_active_state(user_id, payload, current_user)
```

Also call `require_active_current_user(current_user)` in `list_users` and `update_user_role`.

- [ ] **Step 9: Update database schema for pending signup**

In `DB_SCHEMA_TEAM_REQUEST_HUB.sql`:

- Change `is_active boolean not null default true` to:

```sql
is_active boolean not null default false,
```

- Change `handle_new_auth_user()` insert to include `is_active`:

```sql
insert into public.users (id, email, name, avatar_url, role, is_active)
values (
  new.id,
  new.email,
  coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
  new.raw_user_meta_data ->> 'avatar_url',
  'fe',
  false
);
```

- Add a comment near the trigger:

```sql
-- New signups start inactive. A lead must approve the profile by setting is_active = true.
```

- [ ] **Step 10: Update docs**

Update `docs/database-schema.md`:

```md
## Auth Profile Trigger

`public.handle_new_auth_user()` creates a matching `public.users` profile after Supabase Auth signup. New users default to role `fe` and `is_active = false`; a lead must approve the user before they can use request workflow endpoints.
```

Update `docs/permissions.md` with:

```md
## Pending Approval

New users can authenticate but start with `is_active = false`. `/users/me` returns the profile so the frontend can show a pending approval screen. Request, notification, user-list, and admin endpoints reject inactive users until a lead approves them.
```

- [ ] **Step 11: Run backend tests**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
```

Expected: PASS.

- [ ] **Step 12: Commit backend approval gate**

Run:

```powershell
rtk git status --short
rtk git add DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md docs/permissions.md apps/api/app apps/api/tests
rtk git commit -m "feat: require lead approval for new users"
```

---

## Task 2: Active-User Dropdowns For Create And Reassign

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Modify: `apps/web/src/lib/api/users.ts`
- Modify: `apps/web/src/hooks/use-users.ts`
- Modify: `apps/web/src/components/requests/request-form.tsx`
- Modify: `apps/web/src/components/requests/reassign-dialog.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`
- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/components/requests/request-timeline.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
RequestForm
ReassignDialog
RequestCard
RequestDetail
RequestTimeline
useUsers
listUsers
queryKeys
```

If unavailable, inspect direct imports with:

```powershell
rtk rg -n "RequestForm|ReassignDialog|RequestCard|RequestDetail|RequestTimeline|useUsers|listUsers|queryKeys" apps/web/src
```

- [ ] **Step 2: Extend frontend user types**

In `apps/web/src/types/index.ts`, update:

```ts
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}
```

Also update `CurrentUser` in `apps/web/src/lib/api/users.ts` to include:

```ts
is_active: boolean;
```

- [ ] **Step 3: Add assignable user API and hook**

In `apps/web/src/lib/api/query-keys.ts`, add:

```ts
assignableUsers: ["users", "active"] as const,
```

In `apps/web/src/lib/api/users.ts`, add:

```ts
export function listActiveUsers() {
  return apiFetch<User[]>("/users/active");
}
```

In `apps/web/src/hooks/use-users.ts`, add:

```ts
export function useActiveUsers() {
  return useQuery({
    queryKey: queryKeys.assignableUsers,
    queryFn: listActiveUsers,
  });
}
```

- [ ] **Step 4: Add shared display helper inside request UI**

Create a small local helper in each touched component or a shared helper file `apps/web/src/components/requests/user-display.ts`:

```ts
import type { User } from "@/types";

export function formatUserLabel(user: Pick<User, "email" | "name">) {
  return user.name ? `${user.name} (${user.email})` : user.email;
}

export function findUserLabel(users: User[] | undefined, userId?: string | null) {
  if (!userId) {
    return "Unassigned";
  }

  const user = users?.find((item) => item.id === userId);
  return user ? formatUserLabel(user) : userId;
}
```

If this helper file is created, import it from request components.

- [ ] **Step 5: Add optional assignee dropdown to create form**

In `apps/web/src/components/requests/request-form.tsx`:

- Import `useActiveUsers`.
- Add state:

```ts
const [assignedTo, setAssignedTo] = useState("");
const activeUsersQuery = useActiveUsers();
```

- Send:

```ts
assigned_to: assignedTo || null,
```

- Add a select field after Priority:

```tsx
<label className="grid gap-2 text-sm font-medium text-[#111827]">
  Assignee
  <select
    className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm font-normal"
    value={assignedTo}
    onChange={(event) => setAssignedTo(event.target.value)}
    disabled={activeUsersQuery.isLoading}
  >
    <option value="">Leave in pool</option>
    {(activeUsersQuery.data ?? []).map((user) => (
      <option key={user.id} value={user.id}>
        {user.name ? `${user.name} (${user.email})` : user.email}
      </option>
    ))}
  </select>
  <span className="text-xs font-normal text-[#6b7280]">
    Choose an active teammate or leave this request available in the pool.
  </span>
</label>
```

- [ ] **Step 6: Replace reassign raw ID with dropdown**

In `apps/web/src/components/requests/reassign-dialog.tsx`:

- Import and call `useActiveUsers`.
- Replace the raw text input for `assigned_to` with a select:

```tsx
<select
  className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm"
  value={assignedTo}
  onChange={(event) => setAssignedTo(event.target.value)}
  disabled={usersQuery.isLoading}
  required
>
  <option value="">Select teammate</option>
  {(usersQuery.data ?? []).map((user) => (
    <option key={user.id} value={user.id}>
      {user.name ? `${user.name} (${user.email})` : user.email}
    </option>
  ))}
</select>
```

Keep reason behavior unchanged.

- [ ] **Step 7: Show assignee names in cards/detail/timeline**

In `RequestCard`, `RequestDetail`, and `RequestTimeline`, use `useActiveUsers()` or pass a `usersById` map from parent if already convenient. Display:

```tsx
{findUserLabel(activeUsersQuery.data, request.assigned_to)}
```

For assignment history:

```tsx
{findUserLabel(activeUsersQuery.data, item.to_user_id)}
```

If an older inactive user is not returned by `/users/active`, fall back to the raw ID so no data disappears.

- [ ] **Step 8: Run frontend checks**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: both PASS.

- [ ] **Step 9: Commit dropdown work**

Run:

```powershell
rtk git status --short
rtk git add apps/web/src
rtk git commit -m "feat: add user dropdowns for assignment"
```

---

## Task 3: Pool Visible To All Roles

**Files:**
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify: `docs/permissions.md`

- [ ] **Step 1: Confirm backend already allows pool visibility**

Read `apps/api/app/core/permissions.py` and confirm this existing logic remains:

```python
if request.get("assigned_to") is None:
    return
```

No backend change is needed for read visibility unless tests prove otherwise.

- [ ] **Step 2: Update navigation role gating**

In `apps/web/src/components/app/app-shell.tsx`, change:

```ts
{ href: "/pool", label: "Pool", roles: ["be", "lead"] },
```

to:

```ts
{ href: "/pool", label: "Pool" },
```

Do not loosen the visibility of `/all` or `/admin/users`.

- [ ] **Step 3: Update pool page copy if needed**

If `apps/web/src/app/(dashboard)/pool/page.tsx` says only backend owners/leads, change the copy to:

```tsx
Unassigned requests available for teammates to review and pick up.
```

- [ ] **Step 4: Update permissions docs**

In `docs/permissions.md`, replace pool role wording with:

```md
- Unassigned pending requests appear in the pool and can be viewed by active users.
- Active users can self-assign from the pool; backend rejects invalid state changes.
```

- [ ] **Step 5: Verify frontend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: both PASS.

- [ ] **Step 6: Commit pool nav work**

Run:

```powershell
rtk git status --short
rtk git add apps/web/src/components/app/app-shell.tsx 'apps/web/src/app/(dashboard)/pool/page.tsx' docs/permissions.md
rtk git commit -m "fix: show request pool to all active roles"
```

---

## Task 4: Public Home, Login/Register, And Pending Approval UI

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/pending-approval/page.tsx`
- Create: `apps/web/src/components/auth/auth-form.tsx`
- Modify: `apps/web/src/components/auth/google-login-button.tsx`
- Modify: `apps/web/src/lib/supabase/middleware.ts`
- Modify: `apps/web/src/hooks/use-current-user.ts`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
HomePage
LoginPage
GoogleLoginButton
updateSession
useCurrentUser
AppShell
```

If unavailable, inspect imports:

```powershell
rtk rg -n "HomePage|LoginPage|GoogleLoginButton|updateSession|useCurrentUser|AppShell" apps/web/src
```

- [ ] **Step 2: Build auth form**

Create `apps/web/src/components/auth/auth-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsPending(true);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    setIsPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "register") {
      setMessage("Registration received. A lead must approve your account before you can enter.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-1">
        <button type="button" className={mode === "login" ? "rounded-md bg-white px-3 py-2 text-sm font-medium" : "px-3 py-2 text-sm"} onClick={() => setMode("login")}>
          Login
        </button>
        <button type="button" className={mode === "register" ? "rounded-md bg-white px-3 py-2 text-sm font-medium" : "px-3 py-2 text-sm"} onClick={() => setMode("register")}>
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input className="h-10 rounded-md border border-[#e5e7eb] px-3 text-sm font-normal" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input className="h-10 rounded-md border border-[#e5e7eb] px-3 text-sm font-normal" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </label>
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Working..." : mode === "login" ? "Login" : "Register"}
        </Button>
      </form>
    </div>
  );
}
```

Refactor formatting if lint requires shorter lines.

- [ ] **Step 3: Update login page**

In `apps/web/src/app/(auth)/login/page.tsx`, render `AuthForm` and keep `GoogleLoginButton` as an alternative:

```tsx
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="grid w-full max-w-[560px] gap-6 rounded-lg bg-white p-8 shadow-[rgba(0,0,0,0.14)_0_8px_28px_0]">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#111827]">Team Request Hub</h1>
          <p className="mt-2 text-sm text-[#6b7280]">Login or register for lead approval.</p>
        </div>
        <AuthForm />
        <div className="grid gap-3 border-t border-[#e5e7eb] pt-4">
          <GoogleLoginButton />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Replace root redirect with public home page**

In `apps/web/src/app/page.tsx`, replace redirect with a public landing screen:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <section className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-4 py-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">Team Request Hub</h1>
          <p className="mt-4 text-base leading-7 text-[#4b5563]">
            Internal requests, ownership, status updates, and approvals in one focused workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login?mode=register">Register</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
```

If `LoginPage` reads `searchParams`, pass `initialMode="register"` when `mode=register`.

- [ ] **Step 5: Add pending approval page**

Create `apps/web/src/app/(auth)/pending-approval/page.tsx`:

```tsx
import { LogoutButton } from "@/components/auth/logout-button";

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="grid max-w-lg gap-4 rounded-lg border border-[#e5e7eb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">Waiting for lead approval</h1>
        <p className="text-sm leading-6 text-[#4b5563]">
          Your account has been created, but a lead must approve it before you can use Team Request Hub.
        </p>
        <div className="mx-auto">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Route inactive users to pending approval**

Update `apps/web/src/components/app/app-shell.tsx` so if `currentUser?.is_active === false`, it renders a pending message or redirects to `/pending-approval`. Prefer a render guard to avoid client redirect loops:

```tsx
if (currentUser?.is_active === false) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="grid max-w-lg gap-4 rounded-lg border border-[#e5e7eb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">Waiting for lead approval</h1>
        <p className="text-sm text-[#4b5563]">A lead must approve your account before you can access requests.</p>
        <LogoutButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Keep middleware simple**

In `apps/web/src/lib/supabase/middleware.ts`, keep unauthenticated protected-route redirects. Do not call backend from middleware. Add `/pending-approval` as an auth route that authenticated users can visit:

```ts
const isAuthRoute =
  request.nextUrl.pathname.startsWith("/login") ||
  request.nextUrl.pathname.startsWith("/pending-approval");
```

Do not redirect authenticated users away from `/pending-approval`.

- [ ] **Step 8: Verify frontend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: both PASS.

- [ ] **Step 9: Commit auth UI work**

Run:

```powershell
rtk git status --short
rtk git add apps/web/src
rtk git commit -m "feat: add public auth and pending approval UI"
```

---

## Task 5: Lead User Approval UI

**Files:**
- Modify: `apps/web/src/lib/api/users.ts`
- Modify: `apps/web/src/hooks/use-users.ts`
- Modify: `apps/web/src/components/admin/user-role-table.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/users/page.tsx`

- [ ] **Step 1: Add active update API**

In `apps/web/src/lib/api/users.ts`, add:

```ts
export interface UserActiveUpdate {
  is_active: boolean;
}

export function updateUserActiveState(userId: string, payload: UserActiveUpdate) {
  return apiFetch<User>(`/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Add approval mutation hook**

In `apps/web/src/hooks/use-users.ts`, add:

```ts
export function useUpdateUserActiveState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserActiveState(userId, { is_active: isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignableUsers });
    },
  });
}
```

- [ ] **Step 3: Update admin table**

In `apps/web/src/components/admin/user-role-table.tsx`:

- Display active status as `Active` or `Pending`.
- Add button:

```tsx
<Button
  type="button"
  variant={user.is_active ? "outline" : "default"}
  onClick={() =>
    activeMutation.mutate({
      userId: user.id,
      isActive: !user.is_active,
    })
  }
  disabled={activeMutation.isPending}
>
  {user.is_active ? "Disable" : "Approve"}
</Button>
```

Keep role update controls intact.

- [ ] **Step 4: Verify admin UI**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: both PASS.

- [ ] **Step 5: Commit approval UI**

Run:

```powershell
rtk git status --short
rtk git add apps/web/src
rtk git commit -m "feat: add lead user approval controls"
```

---

## Task 6: Performance Diagnosis

**Files:**
- Create: `docs/performance-diagnosis.md`
- No production code changes unless a specific measured bottleneck is found.

- [ ] **Step 1: Record environment**

Run:

```powershell
rtk powershell -NoProfile -Command "Get-ComputerInfo | Select-Object OsName,OsVersion,CsProcessors,CsTotalPhysicalMemory"
rtk powershell -NoProfile -Command "node -v; npm -v; python --version"
rtk powershell -NoProfile -Command "wsl.exe --status"
```

If `wsl.exe --status` fails, record that WSL is not available or not configured.

- [ ] **Step 2: Measure frontend build and lint**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; Measure-Command { npm run lint }"
rtk powershell -NoProfile -Command "cd apps\web; Measure-Command { npm run build }"
```

Record total seconds.

- [ ] **Step 3: Measure backend import/test time**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; Measure-Command { uv --cache-dir .uv-cache run python -m unittest discover tests }"
rtk powershell -NoProfile -Command "cd apps\api; Measure-Command { uv --cache-dir .uv-cache run python -c 'import app.main; print(\"import-ok\")' }"
```

Record total seconds.

- [ ] **Step 4: Measure API latency with backend running**

Start backend in one terminal:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run uvicorn app.main:app --port 8000"
```

In another terminal:

```powershell
rtk powershell -NoProfile -Command "Measure-Command { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health | Out-Null }"
```

Expected: local `/health` should usually be well under one second. If it is slow, investigate backend/runtime. If `/health` is fast but authenticated app pages are slow, suspect Supabase network/auth calls or frontend dev server compilation.

- [ ] **Step 5: Measure Next dev first-load vs warm-load**

Start frontend:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run dev"
```

Measure:

```powershell
rtk powershell -NoProfile -Command "Measure-Command { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000 | Out-Null }"
rtk powershell -NoProfile -Command "Measure-Command { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000 | Out-Null }"
```

Record first request and second request separately. A slow first request with a fast second request usually means Next dev compilation, not WSL.

- [ ] **Step 6: Write diagnosis document**

Create `docs/performance-diagnosis.md` with:

```md
# Performance Diagnosis

## Environment

- OS:
- Node:
- npm:
- Python:
- WSL status:

## Measurements

| Check | Time | Notes |
| --- | ---: | --- |
| Frontend lint |  |  |
| Frontend build |  |  |
| Backend unittest |  |  |
| Backend import |  |  |
| API /health |  |  |
| Next dev first load |  |  |
| Next dev warm load |  |  |

## Conclusion

State whether the slowdown is most likely WSL/runtime, Next dev compilation, backend import/test time, Supabase network/auth latency, or browser-side API waterfalls.

## Recommended Follow-Up

List only measured next steps. Do not guess.
```

- [ ] **Step 7: Commit diagnosis**

Run:

```powershell
rtk git status --short
rtk git add docs/performance-diagnosis.md
rtk git commit -m "docs: add performance diagnosis"
```

---

## Task 7: Full Verification And Scope Review

**Files:**
- No new implementation files expected.

- [ ] **Step 1: Detect changed scope**

Run GitNexus change detection if available:

```txt
gitnexus_detect_changes()
```

If unavailable:

```powershell
rtk git diff --stat
rtk git diff --name-only
```

Confirm changes are limited to assignment UI, pool visibility, approval flow, docs, and performance diagnosis.

- [ ] **Step 2: Run backend verification**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
```

Expected: PASS.

- [ ] **Step 3: Run frontend verification**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: PASS.

- [ ] **Step 4: Manual browser smoke**

With backend and frontend running, verify:

```txt
1. Public `/` shows Login and Register buttons.
2. `/login` supports login and registration modes.
3. Newly registered user sees pending approval state and cannot access request pages.
4. Lead can open `/admin/users` and approve a pending user.
5. Approved user can access dashboard.
6. Pool nav appears for fe, be, and lead.
7. Create request form has Assignee dropdown and can leave request in pool.
8. Create request with assignee creates an assigned request.
9. Reassign dialog uses a dropdown instead of raw user ID.
10. Request card/detail/timeline show readable user labels when user data is available.
```

- [ ] **Step 5: Final commit if needed**

If Task 7 created any cleanup changes:

```powershell
rtk git status --short
rtk git add DB_SCHEMA_TEAM_REQUEST_HUB.sql docs apps/api/app apps/api/tests apps/web/src
rtk git commit -m "chore: verify mission requirements"
```

---

## Acceptance Criteria

- Creating a request supports `Leave in pool` or selecting an active user.
- Reassign UI no longer requires typing a raw UUID.
- Request cards/details/timeline show readable assignee labels when possible.
- Pool is visible to all active roles.
- New users start inactive and cannot use protected request workflow until a lead approves them.
- Lead users can approve/disable users from admin UI.
- Public home page has clear login/register entry points.
- Performance diagnosis exists with measured evidence and a conclusion about WSL/runtime likelihood.
- Backend tests pass.
- Frontend lint and build pass.

## Known Risks

- Existing Supabase projects need the updated SQL applied manually; changing `DB_SCHEMA_TEAM_REQUEST_HUB.sql` alone does not migrate an already-created database.
- Email/password registration requires Supabase Auth email settings to allow signups. If the project only wants Google OAuth, registration can still use Google but the approval gate remains the same.
- `/users/active` returns only active users, so old inactive assignees may still display as raw IDs unless a broader user lookup is added.
- Middleware cannot safely call the backend for active status without adding latency; pending approval is handled inside authenticated app components.
