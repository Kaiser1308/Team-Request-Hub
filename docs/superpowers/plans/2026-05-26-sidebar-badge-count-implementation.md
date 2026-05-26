# Sidebar Badge Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unread notification count badges next to the "Assigned" and "Pool" sidebar items that clear when the user navigates to the corresponding route.

**Architecture:** Backend adds a `POST /notifications/read-by-type` endpoint to mark notifications as read by type. Frontend adds a `useRouteBadgeCounts` hook that filters unread notifications by type, and renders a red pill badge on sidebar nav items. Clicking a nav item calls the mark-read-by-type endpoint and invalidates the query.

**Tech Stack:** FastAPI (backend), Next.js 15 + TanStack Query v5 + Tailwind CSS v4 (frontend)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/app/schemas/notifications.py` | Add `NotificationsReadByTypeIn` request schema |
| Modify | `apps/api/app/notification_module/_store.py` | Add `mark_notifications_read_by_type()` store function |
| Modify | `apps/api/app/notification_module/__init__.py` | Add public `mark_notifications_read_by_type()` |
| Modify | `apps/api/app/routes/notifications.py` | Add `POST /read-by-type` endpoint |
| Modify | `apps/api/tests/test_notification_routes.py` | Add test for new endpoint |
| Modify | `apps/web/src/lib/api/notifications.ts` | Add `markNotificationsReadByType()` |
| Modify | `apps/web/src/hooks/use-notifications.ts` | Add `useRouteBadgeCounts()` hook |
| Modify | `apps/web/src/components/app/app-shell.tsx` | Add badge rendering + clear-on-nav logic |

---

### Task 1: Backend — Add request schema

**Files:**
- Modify: `apps/api/app/schemas/notifications.py`

- [ ] **Step 1: Add `NotificationsReadByTypeIn` schema**

In `apps/api/app/schemas/notifications.py`, add after the `NotificationsReadAllOut` class (after line 28):

```python
class NotificationsReadByTypeIn(BaseModel):
    types: list[NotificationType]
```

Also import `NotificationType` at the top — it is already imported via the `Literal` on line 6, so no additional import needed. The full file becomes:

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


class NotificationsReadAllOut(BaseModel):
    updated: int


class NotificationsReadByTypeIn(BaseModel):
    types: list[NotificationType]
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/schemas/notifications.py
git commit -m "feat(api): add NotificationsReadByTypeIn schema"
```

---

### Task 2: Backend — Add store function

**Files:**
- Modify: `apps/api/app/notification_module/_store.py`

- [ ] **Step 1: Add `mark_notifications_read_by_type()` function**

In `apps/api/app/notification_module/_store.py`, add after `mark_all_notifications_read()` (after line 71):

```python
def mark_notifications_read_by_type(user_id: str, types: list[str]) -> int:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .in_("type", types)
        .execute()
    )
    return len(result.data or [])
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/notification_module/_store.py
git commit -m "feat(api): add mark_notifications_read_by_type store function"
```

---

### Task 3: Backend — Add public module function

**Files:**
- Modify: `apps/api/app/notification_module/__init__.py`

- [ ] **Step 1: Add `mark_notifications_read_by_type()` to public interface**

In `apps/api/app/notification_module/__init__.py`, add after `mark_all_notifications_read()` (after line 41):

```python
def mark_notifications_read_by_type(user_id: str, types: list[str]) -> dict:
    return {"updated": _store.mark_notifications_read_by_type(user_id, types)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/notification_module/__init__.py
git commit -m "feat(api): add mark_notifications_read_by_type to notification module"
```

---

### Task 4: Backend — Add route endpoint

**Files:**
- Modify: `apps/api/app/routes/notifications.py`
- Modify: `apps/api/tests/test_notification_routes.py`

- [ ] **Step 1: Add `POST /read-by-type` endpoint**

In `apps/api/app/routes/notifications.py`, update the import on line 6 to also import the new schema:

```python
from app.schemas.notifications import NotificationOut, NotificationsReadAllOut, NotificationsReadByTypeIn
```

Then add the new endpoint **before** the `/{notification_id}/read` endpoint (insert before line 31). This is critical — FastAPI resolves routes in order, so `/read-by-type` must come before `/{notification_id}/read` to avoid being captured as a notification_id parameter:

```python
@router.post("/read-by-type", response_model=NotificationsReadAllOut)
async def mark_notifications_read_by_type(
    body: NotificationsReadByTypeIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_notifications_read_by_type(
        current_user.id, body.types
    )
```

- [ ] **Step 2: Add test for the new endpoint**

In `apps/api/tests/test_notification_routes.py`, add a new test method inside the `NotificationRoutesTests` class (after line 55, before the `if __name__` block):

```python
def test_read_by_type_forwards_types(self):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="user-1",
        email="user@example.com",
        name="User",
        role="fe",
    )

    with patch("app.routes.notifications.notification_module.mark_notifications_read_by_type") as mock_fn:
        mock_fn.return_value = {"updated": 2}

        response = TestClient(app).post(
            "/notifications/read-by-type",
            json={"types": ["assigned", "reassigned"]},
        )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), {"updated": 2})
    mock_fn.assert_called_once_with("user-1", ["assigned", "reassigned"])
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && uv --cache-dir .uv-cache run python -m pytest tests/test_notification_routes.py -v`
Expected: All tests pass including the new one

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routes/notifications.py apps/api/tests/test_notification_routes.py
git commit -m "feat(api): add POST /notifications/read-by-type endpoint with test"
```

---

### Task 5: Frontend — Add API function

**Files:**
- Modify: `apps/web/src/lib/api/notifications.ts`

- [ ] **Step 1: Add `markNotificationsReadByType()` function**

In `apps/web/src/lib/api/notifications.ts`, add after the `markAllNotificationsRead()` function (after line 23):

```typescript
export function markNotificationsReadByType(types: string[]) {
  return apiFetch<{ updated: number }>("/notifications/read-by-type", {
    method: "POST",
    body: JSON.stringify({ types }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api/notifications.ts
git commit -m "feat(web): add markNotificationsReadByType API function"
```

---

### Task 6: Frontend — Add `useRouteBadgeCounts` hook

**Files:**
- Modify: `apps/web/src/hooks/use-notifications.ts`

- [ ] **Step 1: Add the hook**

In `apps/web/src/hooks/use-notifications.ts`, update the import to include the new API function. Change line 4-8 to:

```typescript
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsReadByType,
} from "@/lib/api/notifications";
```

Then add at the end of the file (after line 39):

```typescript
const ASSIGNED_TYPES = new Set(["assigned", "reassigned"]);
const POOL_TYPES = new Set(["pool_new"]);

export function useRouteBadgeCounts() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "route-badges"] as const,
    queryFn: async () => {
      const notifications = await listNotifications(true);
      let assigned = 0;
      let pool = 0;
      for (const n of notifications) {
        if (ASSIGNED_TYPES.has(n.type)) assigned++;
        if (POOL_TYPES.has(n.type)) pool++;
      }
      return { assigned, pool };
    },
    staleTime: 20 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMarkRouteBadgeRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (types: string[]) => markNotificationsReadByType(types),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.notifications, "route-badges"],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-notifications.ts
git commit -m "feat(web): add useRouteBadgeCounts and useMarkRouteBadgeRead hooks"
```

---

### Task 7: Frontend — Update sidebar with badges and clear-on-nav

**Files:**
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Add `notificationTypes` to NavItem interface and navItems array**

In `apps/web/src/components/app/app-shell.tsx`:

Update the `NavItem` interface (lines 45-50) to add `notificationTypes`:

```typescript
interface NavItem {
  href: string;
  labelKey: NavLabelKey;
  roles?: Role[];
  icon: LucideIcon;
  notificationTypes?: string[];
}
```

Update the `navItems` array — add `notificationTypes` to the assigned and pool items (lines 54, 56):

```typescript
const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/assigned", labelKey: "assigned", icon: UserCheck, notificationTypes: ["assigned", "reassigned"] },
  { href: "/requests", labelKey: "created", icon: FileText },
  { href: "/pool", labelKey: "pool", icon: Inbox, notificationTypes: ["pool_new"] },
  { href: "/done", labelKey: "done", icon: CheckCircle2 },
  { href: "/all", labelKey: "all", roles: ["lead"], icon: Database },
  { href: "/files", labelKey: "files", icon: FolderOpen },
  { href: "/admin/users", labelKey: "users", roles: ["lead"], icon: Users },
  { href: "/requests/new", labelKey: "newRequest", icon: PlusCircle },
];
```

- [ ] **Step 2: Add imports and hooks**

Update the import from `@/hooks/use-notifications` (line 27):

```typescript
import { useNotifications, useRouteBadgeCounts, useMarkRouteBadgeRead } from "@/hooks/use-notifications";
```

Inside the `AppShell` component, after `const unreadCount = ...` (line 107), add:

```typescript
const badgeCounts = useRouteBadgeCounts();
const markBadgeRead = useMarkRouteBadgeRead();

const badgeForItem = (item: NavItem): number => {
  if (!item.notificationTypes) return 0;
  if (item.notificationTypes.includes("assigned")) return badgeCounts.data?.assigned ?? 0;
  if (item.notificationTypes.includes("pool_new")) return badgeCounts.data?.pool ?? 0;
  return 0;
};
```

- [ ] **Step 3: Update nav item rendering to show badge and clear on click**

Replace the `onClick` handler and add badge rendering. Update the nav item rendering block (lines 209-233) to:

```tsx
{visibleNavItems.map((item) => {
  const Icon = item.icon;
  const badge = badgeForItem(item);
  return (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => {
        setIsMobileNavOpen(false);
        if (item.notificationTypes && item.notificationTypes.length > 0) {
          markBadgeRead.mutate(item.notificationTypes);
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#d1d5db] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40",
        isActivePath(pathname, item.href) &&
          "bg-[#1f2937] font-medium text-white",
      )}
      aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 text-[#9ca3af] transition-colors group-hover:text-white",
          isActivePath(pathname, item.href) && "text-white",
        )}
        aria-hidden="true"
      />
      <span className="flex-1">{tNav(item.labelKey)}</span>
      {badge > 0 && (
        <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
})}
```

- [ ] **Step 4: Run lint and build**

Run: `cd apps/web && npm run lint`
Expected: No errors

Run: `cd apps/web && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app/app-shell.tsx
git commit -m "feat(web): add badge counts to Assigned and Pool sidebar items"
```

---

### Task 8: Verify end-to-end

- [ ] **Step 1: Run backend tests**

Run: `cd apps/api && uv --cache-dir .uv-cache run python -m pytest tests/test_notification_routes.py -v`
Expected: All tests pass

- [ ] **Step 2: Run frontend build**

Run: `cd apps/web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: fix lint issues from badge count feature"
```
