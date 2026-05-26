# Sidebar Badge Count for Assigned & Pool Routes

## Problem

When new requests appear in "Assigned" or "Pool", users have no visual indicator on the sidebar. They must check each page or rely on the notification bell, which requires an extra click and doesn't show which route has new items.

## Solution

Add unread notification count badges next to the "Assigned" (`/assigned`) and "Pool" (`/pool`) sidebar items. Badges clear automatically when the user navigates to the corresponding route.

## Scope

- **Affected routes**: `/assigned` and `/pool` only
- **Count source**: Unread notifications filtered by type
- **Badge behavior**: Show count > 0, hide at 0, clear on route visit

## Notification Type Mapping

| Route | Notification Types |
|-------|-------------------|
| `/assigned` | `assigned`, `reassigned` |
| `/pool` | `pool_new` |

## Backend Changes

### New endpoint: `POST /notifications/read-by-type`

**File**: `apps/api/app/routes/notifications.py`

- Request body: `{ "types": ["assigned", "reassigned"] }`
- Marks all unread notifications of the current user matching the given types as `is_read = true`
- Returns `{ "updated": N }`

### New function: `mark_notifications_read_by_type()`

**File**: `apps/api/app/notification_module/__init__.py`

- Accepts `user_id` and list of `types`
- Calls the store layer to update `is_read` for matching rows

### Store layer addition

**File**: `apps/api/app/notification_module/_store.py`

- New function to update `notifications` table: `SET is_read = true WHERE user_id = ? AND type IN (?) AND is_read = false`

## Frontend Changes

### New API function

**File**: `apps/web/src/lib/api/notifications.ts`

- `markNotificationsReadByType(types: string[])` — calls `POST /notifications/read-by-type`

### New hook: `useRouteBadgeCounts()`

**File**: `apps/web/src/hooks/use-notifications.ts`

- Calls existing `GET /notifications?unread_only=true`
- Filters results by notification type
- Returns `{ assigned: number, pool: number }`
- Query key: `["notifications", "route-badges"]`
- Stale time: 20 seconds
- Uses the same underlying `listNotifications` API call but derives route-specific counts

### NavItem type update

**File**: `apps/web/src/components/app/app-shell.tsx`

- Add optional field `notificationTypes?: string[]` to `NavItem`
- `/assigned` item gets `notificationTypes: ["assigned", "reassigned"]`
- `/pool` item gets `notificationTypes: ["pool_new"]`

### Sidebar badge rendering

**File**: `apps/web/src/components/app/app-shell.tsx`

- In the sidebar nav item rendering loop, look up badge count from `useRouteBadgeCounts()` by matching `item.notificationTypes`
- Render badge pill when count > 0
- Badge style: `bg-red-500 text-white text-[10px] font-medium min-w-[18px] h-[18px] rounded-full flex items-center justify-center`
- Positioned inline after the label text
- Completely hidden when count is 0 (no empty badge)

### Clear on navigation

**File**: `apps/web/src/components/app/app-shell.tsx`

- When a nav item with `notificationTypes` is clicked, call `markNotificationsReadByType(item.notificationTypes)`
- Invalidate the `["notifications", "route-badges"]` query to refresh counts
- Badge disappears immediately on navigation

## Data Flow

```
App loads
  → useRouteBadgeCounts() fetches unread notifications
  → filters by type → { assigned: 3, pool: 5 }
  → sidebar renders badges

User clicks /assigned
  → markNotificationsReadByType(["assigned", "reassigned"])
  → invalidate ["notifications", "route-badges"]
  → assigned badge clears, other badges remain

User clicks /pool
  → markNotificationsReadByType(["pool_new"])
  → invalidate ["notifications", "route-badges"]
  → pool badge clears
```

## Badge Visual

Small red pill to the right of the nav label text, inside the same flex container:

```
┌──────────────────────┐
│ 📥  Pool        (5)  │  ← red pill badge
│ 👤  Assigned    (3)  │  ← red pill badge
│ 📄  Created          │  ← no badge
│ ✅  Done             │  ← no badge
└──────────────────────┘
```

## Files Changed

| File | Change |
|------|--------|
| `apps/api/app/routes/notifications.py` | Add `POST /read-by-type` endpoint |
| `apps/api/app/notification_module/__init__.py` | Add `mark_notifications_read_by_type()` |
| `apps/api/app/notification_module/_store.py` | Add store function for bulk update by type |
| `apps/api/app/schemas/notifications.py` | Add request schema for read-by-type |
| `apps/web/src/lib/api/notifications.ts` | Add `markNotificationsReadByType()` |
| `apps/web/src/hooks/use-notifications.ts` | Add `useRouteBadgeCounts()` hook |
| `apps/web/src/components/app/app-shell.tsx` | Add badge rendering + nav type config + clear logic |

## Out of Scope

- Badge on other routes (created, done, all, files)
- Real-time updates via WebSocket/Supabase Realtime
- Badge persistence across sessions (already handled by notification is_read state)
