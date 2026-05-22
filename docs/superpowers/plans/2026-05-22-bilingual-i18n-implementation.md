# Bilingual I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vietnamese/English frontend localization with Vietnamese as the default, no locale URL prefixes, and a persisted language switcher.

**Architecture:** Use `next-intl` in `apps/web` with cookie-backed locale selection. Keep all existing routes unchanged, wrap the app in a locale provider at the root layout, and replace hard-coded UI strings with namespaced translation keys.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `next-intl`, Tailwind CSS v4, existing Supabase auth/session middleware.

---

## File Structure

Create:

- `apps/web/src/i18n/config.ts`: supported locale constants, cookie name, and locale parsing helpers.
- `apps/web/src/i18n/messages/en.json`: English messages.
- `apps/web/src/i18n/messages/vi.json`: Vietnamese messages.
- `apps/web/src/i18n/request.ts`: server-side message loading for `next-intl`.
- `apps/web/src/components/app/language-switcher.tsx`: client language selector that writes the locale cookie and refreshes the current route.
- `apps/web/src/components/requests/translated-labels.ts`: small helper functions for request status, priority, role, account state, and date formatting labels.

Modify:

- `apps/web/package.json`: add `next-intl` dependency.
- `apps/web/next.config.ts`: enable the `next-intl` plugin.
- `apps/web/src/app/layout.tsx`: load locale/messages, set `<html lang>`, and wrap children in `NextIntlClientProvider`.
- `apps/web/src/components/app/app-shell.tsx`: translate navigation, page titles, shell labels, inactive approval copy, and add `LanguageSwitcher`.
- `apps/web/src/components/auth/google-login-button.tsx`: translate Google sign-in button and frontend error fallback.
- `apps/web/src/components/auth/logout-button.tsx`: translate sign-out button.
- `apps/web/src/app/(auth)/login/page.tsx`: translate login screen copy.
- `apps/web/src/app/(auth)/pending-approval/page.tsx`: translate pending approval page copy.
- `apps/web/src/app/(dashboard)/*/page.tsx`: translate page headers and per-view empty/forbidden messages.
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`: translate dashboard labels and use active locale for dates.
- `apps/web/src/components/requests/*.tsx`: translate request UI text, frontend validation errors, enum display labels, and date formatting locale.
- `apps/web/src/components/notifications/notification-list.tsx`: translate notification UI labels and date formatting locale.
- `apps/web/src/components/admin/user-role-table.tsx`: translate admin table labels, state labels, action buttons, frontend fallback errors, and dates.
- `apps/web/src/components/shared/*.tsx`: translate shared fallback strings only where components own strings; keep prop-driven components unchanged.

Verification:

- Run `npm install` from `apps/web` after adding `next-intl`.
- Run `npm run lint` from `apps/web`.
- Run `npm run build` from `apps/web`.
- Manually check `/login`, `/dashboard`, `/requests`, `/requests/new`, request detail, notifications, and `/admin/users` in both languages.

### Task 1: Install and Configure `next-intl`

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/src/i18n/config.ts`
- Create: `apps/web/src/i18n/request.ts`
- Create: `apps/web/src/i18n/messages/en.json`
- Create: `apps/web/src/i18n/messages/vi.json`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Inspect current Next config**

Run from repo root:

```bash
ls apps/web
```

Expected: output includes `next.config.ts`, `package.json`, and `package-lock.json`.

- [ ] **Step 2: Install dependency**

Run from `apps/web`:

```bash
npm install next-intl
```

Expected: `package.json` and `package-lock.json` update with `next-intl`.

- [ ] **Step 3: Add locale config**

Create `apps/web/src/i18n/config.ts`:

```ts
export const locales = ["vi", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "vi";
export const localeCookieName = "trh-locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return locales.some((locale) => locale === value);
}

export function getValidLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
```

- [ ] **Step 4: Add starter messages**

Create `apps/web/src/i18n/messages/en.json`:

```json
{
  "common": {
    "appName": "Team Request Hub",
    "language": "Language",
    "english": "English",
    "vietnamese": "Tiếng Việt",
    "retry": "Retry",
    "close": "Close",
    "cancel": "Cancel",
    "notSet": "Not set",
    "loadingUser": "Loading user",
    "user": "User"
  },
  "errors": {
    "currentUserLoad": "Unable to load the current user.",
    "unexpectedBackendResponse": "The backend returned an unexpected response."
  },
  "nav": {
    "dashboard": "Dashboard",
    "assigned": "Assigned to me",
    "created": "Created by me",
    "pool": "Pool",
    "done": "Done",
    "all": "All requests",
    "users": "Users",
    "newRequest": "New request",
    "requestDetail": "Request detail"
  }
}
```

Create `apps/web/src/i18n/messages/vi.json`:

```json
{
  "common": {
    "appName": "Team Request Hub",
    "language": "Ngôn ngữ",
    "english": "English",
    "vietnamese": "Tiếng Việt",
    "retry": "Thử lại",
    "close": "Đóng",
    "cancel": "Hủy",
    "notSet": "Chưa đặt",
    "loadingUser": "Đang tải người dùng",
    "user": "Người dùng"
  },
  "errors": {
    "currentUserLoad": "Không thể tải người dùng hiện tại.",
    "unexpectedBackendResponse": "Backend trả về phản hồi không như mong đợi."
  },
  "nav": {
    "dashboard": "Tổng quan",
    "assigned": "Việc giao cho tôi",
    "created": "Yêu cầu của tôi",
    "pool": "Hàng chờ",
    "done": "Đã xong",
    "all": "Tất cả yêu cầu",
    "users": "Người dùng",
    "newRequest": "Tạo yêu cầu",
    "requestDetail": "Chi tiết yêu cầu"
  }
}
```

- [ ] **Step 5: Add request loader**

Create `apps/web/src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, getValidLocale, localeCookieName } from "@/i18n/config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get(localeCookieName)?.value);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: "Asia/Ho_Chi_Minh",
    now: new Date(),
    defaultTranslationValues: {},
  };
});

export { defaultLocale };
```

- [ ] **Step 6: Enable plugin in Next config**

Modify `apps/web/next.config.ts` to use the plugin:

```ts
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Wrap root layout**

Modify `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Request Hub",
  description: "Internal request workflow tool for team coordination",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Run build check for integration**

Run from `apps/web`:

```bash
npm run build
```

Expected: build succeeds or fails only because later tasks still need message keys after UI conversion begins. Fix config errors before moving on.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/next.config.ts apps/web/src/app/layout.tsx apps/web/src/i18n
git commit -m "feat: configure frontend i18n"
```

### Task 2: Add Language Switcher and Translate App Shell

**Files:**

- Create: `apps/web/src/components/app/language-switcher.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/i18n/messages/en.json`
- Modify: `apps/web/src/i18n/messages/vi.json`

- [ ] **Step 1: Extend messages for app shell**

Add these keys under `appShell` in both message files.

English:

```json
{
  "appShell": {
    "waitingApprovalTitle": "Waiting for lead approval",
    "waitingApprovalDescription": "A lead must approve your account before you can access requests.",
    "openNavigation": "Open navigation",
    "closeNavigation": "Close navigation",
    "primaryNavigation": "Primary",
    "mainNavigation": "Main navigation",
    "openNotifications": "Open notifications",
    "leadAccessEnabled": "lead access enabled",
    "rolePending": "Role pending",
    "roleLabel": "Role: {role}"
  }
}
```

Vietnamese:

```json
{
  "appShell": {
    "waitingApprovalTitle": "Đang chờ lead duyệt",
    "waitingApprovalDescription": "Lead cần duyệt tài khoản trước khi bạn có thể truy cập yêu cầu.",
    "openNavigation": "Mở điều hướng",
    "closeNavigation": "Đóng điều hướng",
    "primaryNavigation": "Điều hướng chính",
    "mainNavigation": "Điều hướng chính",
    "openNotifications": "Mở thông báo",
    "leadAccessEnabled": "đã bật quyền lead",
    "rolePending": "Vai trò đang chờ",
    "roleLabel": "Vai trò: {role}"
  }
}
```

- [ ] **Step 2: Create language switcher**

Create `apps/web/src/components/app/language-switcher.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { localeCookieName, locales, type AppLocale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("common");

  function handleChange(nextLocale: AppLocale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-200">
      <span className="sr-only">{t("language")}</span>
      <select
        className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs font-medium text-slate-100 outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white/40"
        value={locale}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        aria-label={t("language")}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {item === "vi" ? t("vietnamese") : t("english")}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Translate AppShell constants and functions**

In `apps/web/src/components/app/app-shell.tsx`, import `useTranslations` and `LanguageSwitcher`, change `navItems.label` to translation keys, and change `getPageTitle` to accept a translator.

Use this structure:

```tsx
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/app/language-switcher";

interface NavItem {
  href: string;
  labelKey: "dashboard" | "assigned" | "created" | "pool" | "done" | "all" | "users" | "newRequest";
  roles?: Role[];
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/assigned", labelKey: "assigned", roles: ["be", "lead"], icon: UserCheck },
  { href: "/requests", labelKey: "created", icon: FileText },
  { href: "/pool", labelKey: "pool", roles: ["be", "lead"], icon: Inbox },
  { href: "/done", labelKey: "done", icon: CheckCircle2 },
  { href: "/all", labelKey: "all", roles: ["lead"], icon: Database },
  { href: "/admin/users", labelKey: "users", roles: ["lead"], icon: Users },
  { href: "/requests/new", labelKey: "newRequest", icon: PlusCircle },
];

function getPageTitle(pathname: string, tNav: ReturnType<typeof useTranslations<"nav">>) {
  if (pathname.startsWith("/requests/new")) {
    return tNav("newRequest");
  }

  if (pathname.startsWith("/requests/")) {
    return tNav("requestDetail");
  }

  const titleByPath: Record<string, Parameters<typeof tNav>[0]> = {
    "/dashboard": "dashboard",
    "/assigned": "assigned",
    "/requests": "created",
    "/pool": "pool",
    "/done": "done",
    "/all": "all",
    "/admin/users": "users",
  };

  const key = titleByPath[pathname];
  return key ? tNav(key) : tNav("dashboard");
}
```

If TypeScript rejects the `ReturnType` generic form, use a local callback instead:

```tsx
const titleByPath: Record<string, string> = { ... };
const pageTitle = pathname.startsWith("/requests/new")
  ? tNav("newRequest")
  : pathname.startsWith("/requests/")
    ? tNav("requestDetail")
    : tNav(titleByPath[pathname] as never);
```

- [ ] **Step 4: Translate AppShell render text**

Inside `AppShell`, add:

```tsx
const tCommon = useTranslations("common");
const tNav = useTranslations("nav");
const tShell = useTranslations("appShell");
```

Replace hard-coded strings:

```tsx
<h1 className="text-2xl font-semibold">{tShell("waitingApprovalTitle")}</h1>
<p className="text-sm text-[#4b5563]">{tShell("waitingApprovalDescription")}</p>
aria-label={tShell("closeNavigation")}
aria-label={tShell("primaryNavigation")}
{tCommon("appName")}
aria-label={tShell("mainNavigation")}
<span>{tNav(item.labelKey)}</span>
aria-label={tShell("openNavigation")}
aria-label={tShell("openNotifications")}
isLoading ? tCommon("loadingUser") : currentUser?.name ?? currentUser?.email ?? tCommon("user")
```

Add `<LanguageSwitcher />` before the role badge in the topbar controls.

- [ ] **Step 5: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: no lint errors. Fix typing issues in `getPageTitle` before moving on.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: add language switcher"
```

### Task 3: Translate Auth Screens and Buttons

**Files:**

- Modify: `apps/web/src/components/auth/google-login-button.tsx`
- Modify: `apps/web/src/components/auth/logout-button.tsx`
- Modify: `apps/web/src/components/auth/auth-form.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/pending-approval/page.tsx`
- Modify: `apps/web/src/i18n/messages/en.json`
- Modify: `apps/web/src/i18n/messages/vi.json`

- [ ] **Step 1: Add auth messages**

Add `auth` keys.

English:

```json
{
  "auth": {
    "loginDescription": "Internal request workflow for FE, BE, and lead teams.",
    "companyGooglePrompt": "Sign in with your company Google account.",
    "continueWithGoogle": "Continue with Google",
    "signingIn": "Signing in...",
    "signOut": "Sign out",
    "signingOut": "Signing out...",
    "signInError": "Could not start Google sign-in.",
    "signOutError": "Could not sign out.",
    "pendingApprovalTitle": "Waiting for lead approval",
    "pendingApprovalDescription": "Your account is created but needs lead approval before you can use the request workspace."
  }
}
```

Vietnamese:

```json
{
  "auth": {
    "loginDescription": "Quy trình xử lý yêu cầu nội bộ cho FE, BE và lead.",
    "companyGooglePrompt": "Đăng nhập bằng tài khoản Google công ty.",
    "continueWithGoogle": "Tiếp tục với Google",
    "signingIn": "Đang đăng nhập...",
    "signOut": "Đăng xuất",
    "signingOut": "Đang đăng xuất...",
    "signInError": "Không thể bắt đầu đăng nhập Google.",
    "signOutError": "Không thể đăng xuất.",
    "pendingApprovalTitle": "Đang chờ lead duyệt",
    "pendingApprovalDescription": "Tài khoản của bạn đã được tạo nhưng cần lead duyệt trước khi dùng workspace yêu cầu."
  }
}
```

- [ ] **Step 2: Translate login page**

Modify `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default async function LoginPage() {
  const tCommon = await getTranslations("common");
  const tAuth = await getTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-8">
      <div className="grid w-full max-w-[460px] gap-5 rounded-lg border border-[#e5e7eb] bg-white p-6 shadow-[rgba(17,24,39,0.08)_0_6px_20px_0] sm:p-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#111827]">{tCommon("appName")}</h1>
          <p className="mt-2 text-sm text-[#4b5563]">{tAuth("loginDescription")}</p>
        </div>
        <div className="grid gap-3 border-t border-[#e5e7eb] pt-4">
          <p className="text-center text-sm text-[#6b7280]">{tAuth("companyGooglePrompt")}</p>
          <GoogleLoginButton />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Translate Google login button**

In `apps/web/src/components/auth/google-login-button.tsx`, add `useTranslations("auth")` and replace button/error strings:

```tsx
const t = useTranslations("auth");

setError(t("signInError"));
{isPending ? t("signingIn") : t("continueWithGoogle")}
```

- [ ] **Step 4: Translate logout button**

In `apps/web/src/components/auth/logout-button.tsx`, add `useTranslations("auth")` and replace button/error strings:

```tsx
const t = useTranslations("auth");

setError(t("signOutError"));
{isPending ? t("signingOut") : t("signOut")}
```

- [ ] **Step 5: Translate pending approval page and auth form**

Use `getTranslations` in `apps/web/src/app/(auth)/pending-approval/page.tsx` if it is a server component, or `useTranslations` if it has `"use client"`. Replace the title and description with `auth.pendingApprovalTitle` and `auth.pendingApprovalDescription`.

If `apps/web/src/components/auth/auth-form.tsx` is still rendered anywhere, replace its hard-coded sign-in labels with the same `auth` keys. If it is unused, leave behavior unchanged and only translate visible strings if lint/build includes it.

- [ ] **Step 6: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(auth\) apps/web/src/components/auth apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: translate auth screens"
```

### Task 4: Translate Request Labels, Badges, Lists, and Forms

**Files:**

- Create: `apps/web/src/components/requests/translated-labels.ts`
- Modify: `apps/web/src/components/requests/request-status-badge.tsx`
- Modify: `apps/web/src/components/requests/request-priority-badge.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`
- Modify: `apps/web/src/components/requests/request-list.tsx`
- Modify: `apps/web/src/components/requests/request-form.tsx`
- Modify: `apps/web/src/app/(dashboard)/assigned/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pool/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/done/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/all/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/new/page.tsx`
- Modify: `apps/web/src/i18n/messages/en.json`
- Modify: `apps/web/src/i18n/messages/vi.json`

- [ ] **Step 1: Add request messages**

Add a `requests` namespace with these English keys:

```json
{
  "requests": {
    "status": {
      "all": "All statuses",
      "pending": "Pending",
      "acknowledged": "Acknowledged",
      "in_progress": "In progress",
      "done": "Done",
      "cancelled": "Cancelled",
      "new": "New"
    },
    "priority": {
      "all": "All priorities",
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "urgent": "Urgent"
    },
    "views": {
      "assignedTitle": "Assigned to me",
      "assignedDescription": "Requests assigned to you for acknowledgement, work, and completion.",
      "createdTitle": "Created by me",
      "createdDescription": "Requests you opened for BE teammates and leads.",
      "poolTitle": "Pool",
      "poolDescription": "Unassigned requests available for BE users and leads.",
      "doneTitle": "Done",
      "doneDescription": "Completed requests relevant to you.",
      "allTitle": "All requests",
      "allDescription": "Lead-only view across the request workspace.",
      "newTitle": "New request",
      "newDescription": "Create an internal request with enough context for the assignee."
    },
    "empty": {
      "assigned": "No requests are assigned to you yet.",
      "created": "You have not created any requests yet.",
      "pool": "No unassigned requests are waiting in the pool.",
      "done": "No completed requests yet.",
      "all": "No requests found.",
      "filtered": "No requests match the selected filters."
    },
    "forbidden": {
      "assigned": "Only BE users and leads can view assigned work.",
      "pool": "Only BE users and leads can view the pool.",
      "all": "Only lead users can view all requests."
    },
    "list": {
      "status": "Status",
      "priority": "Priority",
      "createRequest": "Create a request",
      "loadError": "Could not load requests.",
      "forbiddenDefault": "You do not have access to this request view."
    },
    "card": {
      "creator": "Creator",
      "assignee": "Assignee",
      "nextAction": "Next action",
      "updated": "Updated",
      "unassigned": "Unassigned",
      "nextActionPending": "Waiting for acknowledgement",
      "nextActionAcknowledged": "Ready to start",
      "nextActionInProgress": "Awaiting done reply",
      "nextActionDone": "Completed",
      "nextActionCancelled": "Cancelled"
    },
    "form": {
      "title": "Title",
      "description": "Description",
      "priority": "Priority",
      "assignee": "Assignee",
      "leaveInPool": "Leave in pool",
      "assigneeHelp": "Optional. Leave empty to keep this request in the pool.",
      "titleRequired": "Enter a request title.",
      "descriptionRequired": "Enter a request description.",
      "createError": "Could not create the request.",
      "creating": "Creating...",
      "create": "Create request"
    }
  }
}
```

Add Vietnamese equivalents:

```json
{
  "requests": {
    "status": {
      "all": "Tất cả trạng thái",
      "pending": "Đang chờ",
      "acknowledged": "Đã xác nhận",
      "in_progress": "Đang xử lý",
      "done": "Đã xong",
      "cancelled": "Đã hủy",
      "new": "Mới"
    },
    "priority": {
      "all": "Tất cả mức ưu tiên",
      "low": "Thấp",
      "medium": "Trung bình",
      "high": "Cao",
      "urgent": "Khẩn cấp"
    },
    "views": {
      "assignedTitle": "Việc giao cho tôi",
      "assignedDescription": "Các yêu cầu được giao cho bạn để xác nhận, xử lý và hoàn tất.",
      "createdTitle": "Yêu cầu của tôi",
      "createdDescription": "Các yêu cầu bạn đã tạo cho BE và lead.",
      "poolTitle": "Hàng chờ",
      "poolDescription": "Yêu cầu chưa được giao cho BE và lead nhận xử lý.",
      "doneTitle": "Đã xong",
      "doneDescription": "Các yêu cầu đã hoàn tất liên quan đến bạn.",
      "allTitle": "Tất cả yêu cầu",
      "allDescription": "Màn hình chỉ dành cho lead để xem toàn bộ workspace yêu cầu.",
      "newTitle": "Tạo yêu cầu",
      "newDescription": "Tạo yêu cầu nội bộ với đủ ngữ cảnh cho người xử lý."
    },
    "empty": {
      "assigned": "Chưa có yêu cầu nào được giao cho bạn.",
      "created": "Bạn chưa tạo yêu cầu nào.",
      "pool": "Không có yêu cầu chưa giao nào trong hàng chờ.",
      "done": "Chưa có yêu cầu nào hoàn tất.",
      "all": "Không tìm thấy yêu cầu nào.",
      "filtered": "Không có yêu cầu khớp với bộ lọc đã chọn."
    },
    "forbidden": {
      "assigned": "Chỉ BE và lead có thể xem việc được giao.",
      "pool": "Chỉ BE và lead có thể xem hàng chờ.",
      "all": "Chỉ lead có thể xem tất cả yêu cầu."
    },
    "list": {
      "status": "Trạng thái",
      "priority": "Ưu tiên",
      "createRequest": "Tạo yêu cầu",
      "loadError": "Không thể tải danh sách yêu cầu.",
      "forbiddenDefault": "Bạn không có quyền xem màn hình yêu cầu này."
    },
    "card": {
      "creator": "Người tạo",
      "assignee": "Người xử lý",
      "nextAction": "Bước tiếp theo",
      "updated": "Cập nhật",
      "unassigned": "Chưa giao",
      "nextActionPending": "Đang chờ xác nhận",
      "nextActionAcknowledged": "Sẵn sàng bắt đầu",
      "nextActionInProgress": "Chờ phản hồi hoàn tất",
      "nextActionDone": "Đã hoàn tất",
      "nextActionCancelled": "Đã hủy"
    },
    "form": {
      "title": "Tiêu đề",
      "description": "Mô tả",
      "priority": "Ưu tiên",
      "assignee": "Người xử lý",
      "leaveInPool": "Để trong hàng chờ",
      "assigneeHelp": "Không bắt buộc. Để trống để giữ yêu cầu trong hàng chờ.",
      "titleRequired": "Nhập tiêu đề yêu cầu.",
      "descriptionRequired": "Nhập mô tả yêu cầu.",
      "createError": "Không thể tạo yêu cầu.",
      "creating": "Đang tạo...",
      "create": "Tạo yêu cầu"
    }
  }
}
```

- [ ] **Step 2: Add translated label helpers**

Create `apps/web/src/components/requests/translated-labels.ts`:

```ts
import type { RequestPriority, RequestStatus, Role } from "@/types";

export type RequestTranslations = (key: string, values?: Record<string, string | number>) => string;

export function translateStatus(t: RequestTranslations, status: RequestStatus | "all" | "new") {
  return t(`status.${status}`);
}

export function translatePriority(t: RequestTranslations, priority: RequestPriority | "all") {
  return t(`priority.${priority}`);
}

export function translateRole(role: Role) {
  return role.toUpperCase();
}
```

- [ ] **Step 3: Translate status and priority badges**

In `request-status-badge.tsx` and `request-priority-badge.tsx`, use `useTranslations("requests")` and `translateStatus` / `translatePriority` for display text. Keep CSS variant logic based on raw enum values.

Example:

```tsx
const t = useTranslations("requests");
return <span className={className}>{translateStatus(t, status)}</span>;
```

- [ ] **Step 4: Translate request list filters and empty states**

In `request-list.tsx`, import `useTranslations` and helpers. Remove the local `label()` function. Use:

```tsx
const t = useTranslations("requests");

{t("list.status")}
{translateStatus(t, option)}
{t("list.priority")}
{translatePriority(t, option)}
{forbiddenMessage ?? t("list.forbiddenDefault")}
{error instanceof Error ? error.message : t("list.loadError")}
{data?.length ? t("empty.filtered") : emptyMessage}
<Link href="/requests/new">{t("list.createRequest")}</Link>
```

- [ ] **Step 5: Translate request form**

In `request-form.tsx`, use `useTranslations("requests")`. Replace frontend validation and labels:

```tsx
const t = useTranslations("requests");

setTitleError(t("form.titleRequired"));
setDescriptionError(t("form.descriptionRequired"));
{t("form.title")}
{t("form.description")}
{t("form.priority")}
{translatePriority(t, item)}
{t("form.assignee")}
<option value="">{t("form.leaveInPool")}</option>
{t("form.assigneeHelp")}
{normalizeError(actions.create.error, t("form.createError"))}
{tCommon("cancel")}
{actions.create.isPending ? t("form.creating") : t("form.create")}
```

- [ ] **Step 6: Translate request pages**

For each dashboard route page that renders `PageHeader` and `RequestList`, use `getTranslations("requests")` if it is a server component or `useTranslations("requests")` if it is a client component.

Use these mappings:

```tsx
assigned: title views.assignedTitle, description views.assignedDescription, empty empty.assigned, forbidden forbidden.assigned
requests: title views.createdTitle, description views.createdDescription, empty empty.created
pool: title views.poolTitle, description views.poolDescription, empty empty.pool, forbidden forbidden.pool
done: title views.doneTitle, description views.doneDescription, empty empty.done
all: title views.allTitle, description views.allDescription, empty empty.all, forbidden forbidden.all
requests/new: title views.newTitle, description views.newDescription
```

- [ ] **Step 7: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/requests apps/web/src/app/\(dashboard\) apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: translate request views"
```

### Task 5: Translate Request Detail, Actions, Dialogs, and Timeline

**Files:**

- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`
- Modify: `apps/web/src/components/requests/done-dialog.tsx`
- Modify: `apps/web/src/components/requests/reassign-dialog.tsx`
- Modify: `apps/web/src/components/requests/cancel-dialog.tsx`
- Modify: `apps/web/src/components/requests/request-timeline.tsx`
- Modify: `apps/web/src/i18n/messages/en.json`
- Modify: `apps/web/src/i18n/messages/vi.json`

- [ ] **Step 1: Add detail/action/timeline messages**

Add these keys under `requests`.

English:

```json
{
  "detail": {
    "loadError": "Could not load this request.",
    "backToRequests": "Back to requests",
    "creator": "Creator",
    "created": "Created",
    "assigned": "Assigned",
    "updated": "Updated",
    "started": "Started",
    "done": "Done",
    "cancelled": "Cancelled",
    "doneReply": "Done reply",
    "actions": "Actions",
    "historyLoadError": "Could not load request history."
  },
  "actions": {
    "assigning": "Assigning...",
    "selfAssign": "Self assign",
    "acknowledge": "Acknowledge",
    "start": "Start",
    "markDone": "Mark done",
    "markDoneTitle": "Mark request done",
    "completionReplyRequired": "A completion reply is required.",
    "doneReply": "Done reply",
    "doneReplyPlaceholder": "Describe what was completed",
    "replyRequired": "Reply is required.",
    "markDoneError": "Could not mark this request done.",
    "submitting": "Submitting...",
    "submitReply": "Submit reply",
    "reassign": "Reassign",
    "reassignTitle": "Reassign request",
    "assignee": "Assignee",
    "selectTeammate": "Select teammate",
    "reason": "Reason",
    "optionalReason": "Optional reason",
    "selectTeammateError": "Select a teammate before submitting.",
    "reassignError": "Could not reassign this request.",
    "reassigning": "Reassigning...",
    "confirmReassign": "Confirm reassign",
    "cancelRequest": "Cancel request",
    "cancelTitle": "Cancel request",
    "cancelDescription": "This will close the request and notify related users.",
    "cancelReason": "Cancel reason",
    "cancelReasonPlaceholder": "Optional cancellation reason",
    "cancelError": "Could not cancel this request.",
    "cancelling": "Cancelling...",
    "confirmCancel": "Confirm cancel"
  },
  "timeline": {
    "loading": "Loading assignment and status history...",
    "empty": "No timeline events yet.",
    "title": "Assignment and status timeline",
    "assignmentChanged": "Assignment changed",
    "assignedTo": "Assigned to {user}",
    "statusChanged": "Status changed",
    "statusChangeDetail": "{from} -> {to}"
  }
}
```

Vietnamese:

```json
{
  "detail": {
    "loadError": "Không thể tải yêu cầu này.",
    "backToRequests": "Quay lại danh sách yêu cầu",
    "creator": "Người tạo",
    "created": "Ngày tạo",
    "assigned": "Người xử lý",
    "updated": "Cập nhật",
    "started": "Bắt đầu",
    "done": "Hoàn tất",
    "cancelled": "Đã hủy",
    "doneReply": "Phản hồi hoàn tất",
    "actions": "Hành động",
    "historyLoadError": "Không thể tải lịch sử yêu cầu."
  },
  "actions": {
    "assigning": "Đang nhận...",
    "selfAssign": "Tự nhận",
    "acknowledge": "Xác nhận",
    "start": "Bắt đầu",
    "markDone": "Đánh dấu xong",
    "markDoneTitle": "Đánh dấu yêu cầu đã xong",
    "completionReplyRequired": "Cần có phản hồi hoàn tất.",
    "doneReply": "Phản hồi hoàn tất",
    "doneReplyPlaceholder": "Mô tả phần đã hoàn tất",
    "replyRequired": "Cần nhập phản hồi.",
    "markDoneError": "Không thể đánh dấu yêu cầu đã xong.",
    "submitting": "Đang gửi...",
    "submitReply": "Gửi phản hồi",
    "reassign": "Giao lại",
    "reassignTitle": "Giao lại yêu cầu",
    "assignee": "Người xử lý",
    "selectTeammate": "Chọn đồng đội",
    "reason": "Lý do",
    "optionalReason": "Lý do không bắt buộc",
    "selectTeammateError": "Chọn một đồng đội trước khi gửi.",
    "reassignError": "Không thể giao lại yêu cầu này.",
    "reassigning": "Đang giao lại...",
    "confirmReassign": "Xác nhận giao lại",
    "cancelRequest": "Hủy yêu cầu",
    "cancelTitle": "Hủy yêu cầu",
    "cancelDescription": "Yêu cầu sẽ được đóng và người liên quan sẽ nhận thông báo.",
    "cancelReason": "Lý do hủy",
    "cancelReasonPlaceholder": "Lý do hủy không bắt buộc",
    "cancelError": "Không thể hủy yêu cầu này.",
    "cancelling": "Đang hủy...",
    "confirmCancel": "Xác nhận hủy"
  },
  "timeline": {
    "loading": "Đang tải lịch sử giao việc và trạng thái...",
    "empty": "Chưa có sự kiện timeline.",
    "title": "Timeline giao việc và trạng thái",
    "assignmentChanged": "Đã đổi người xử lý",
    "assignedTo": "Đã giao cho {user}",
    "statusChanged": "Đã đổi trạng thái",
    "statusChangeDetail": "{from} -> {to}"
  }
}
```

- [ ] **Step 2: Translate request detail and use locale dates**

In `request-detail.tsx`, use `useLocale` and `useTranslations("requests")`. Change `formatDate` to accept locale and translated `notSet`:

```tsx
function formatDate(value: string | null | undefined, locale: string, notSet: string) {
  if (!value) {
    return notSet;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
```

Replace all labels with `t("detail.creator")`, `t("detail.created")`, etc. Keep `request.title`, `request.description`, and `request.reply` untranslated.

- [ ] **Step 3: Translate request actions**

In `request-actions.tsx`, use `useTranslations("requests")`. Replace button labels:

```tsx
{actions.selfAssign.isPending ? t("actions.assigning") : t("actions.selfAssign")}
{t("actions.acknowledge")}
{t("actions.start")}
```

Do not translate backend mutation error messages if `Error.message` exists.

- [ ] **Step 4: Translate done, reassign, and cancel dialogs**

In each dialog component, use `useTranslations("requests")` and `useTranslations("common")` for close/cancel. Replace validation errors, labels, placeholders, pending labels, and fallback errors with the keys listed in Step 1.

Keep backend error messages raw when `Error.message` exists.

- [ ] **Step 5: Translate timeline**

In `request-timeline.tsx`, use `useLocale`, `useTranslations("requests")`, `translateStatus`, and the active locale for dates. Replace event titles and fallback details:

```tsx
title: t("timeline.assignmentChanged"),
detail: item.reason ?? t("timeline.assignedTo", { user: findUserLabel(activeUsersQuery.data, item.to_user_id) }),
title: t("timeline.statusChanged"),
detail: t("timeline.statusChangeDetail", {
  from: item.from_status ? translateStatus(t, item.from_status) : translateStatus(t, "new"),
  to: translateStatus(t, item.to_status),
})
```

- [ ] **Step 6: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/requests apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: translate request detail actions"
```

### Task 6: Translate Dashboard, Notifications, and Admin Users

**Files:**

- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/src/components/notifications/notification-list.tsx`
- Modify: `apps/web/src/components/admin/user-role-table.tsx`
- Modify: `apps/web/src/i18n/messages/en.json`
- Modify: `apps/web/src/i18n/messages/vi.json`

- [ ] **Step 1: Add dashboard, notifications, and admin messages**

Add English namespaces:

```json
{
  "dashboard": {
    "title": "Dashboard",
    "teamMember": "Team member",
    "leadAccessEnabled": "lead access enabled",
    "rolePending": "Role pending",
    "roleLabel": "Role: {role}",
    "allRequests": "All requests",
    "userManagement": "User management",
    "assigned": "Assigned",
    "created": "Created",
    "pool": "Pool",
    "done": "Done",
    "urgent": "Urgent",
    "recentRequests": "Recent requests",
    "viewAssigned": "View assigned",
    "noRecentRequests": "No recent requests yet.",
    "recentActivity": "Recent activity",
    "openNotifications": "Open notifications",
    "unreadNotifications": "{count, plural, one {# unread notification} other {# unread notifications}}",
    "noUnreadNotifications": "No unread notifications.",
    "loadError": "Could not load dashboard data."
  },
  "notifications": {
    "loadError": "Could not load notifications.",
    "empty": "No notifications yet. New request activity and status updates will appear here.",
    "unreadCount": "{count} unread",
    "marking": "Marking...",
    "markAllRead": "Mark all read",
    "read": "Read",
    "unread": "Unread",
    "viewRequest": "View request",
    "saving": "Saving...",
    "markRead": "Mark read"
  },
  "admin": {
    "forbiddenTitle": "Forbidden",
    "forbiddenDescription": "Only lead users can manage user roles and account access.",
    "loadUsersErrorTitle": "Could not load users",
    "noUsers": "No users found.",
    "unnamed": "Unnamed",
    "name": "Name",
    "email": "Email",
    "role": "Role",
    "state": "State",
    "access": "Access",
    "created": "Created",
    "savingRole": "Saving role...",
    "activeAccount": "Active account",
    "pendingApproval": "Pending approval",
    "disabling": "Disabling...",
    "approving": "Approving...",
    "disable": "Disable",
    "approve": "Approve",
    "roleUpdateError": "Could not update this user role.",
    "accessUpdateError": "Could not update user access state."
  }
}
```

Add Vietnamese equivalents:

```json
{
  "dashboard": {
    "title": "Tổng quan",
    "teamMember": "Thành viên",
    "leadAccessEnabled": "đã bật quyền lead",
    "rolePending": "Vai trò đang chờ",
    "roleLabel": "Vai trò: {role}",
    "allRequests": "Tất cả yêu cầu",
    "userManagement": "Quản lý người dùng",
    "assigned": "Được giao",
    "created": "Đã tạo",
    "pool": "Hàng chờ",
    "done": "Đã xong",
    "urgent": "Khẩn cấp",
    "recentRequests": "Yêu cầu gần đây",
    "viewAssigned": "Xem việc được giao",
    "noRecentRequests": "Chưa có yêu cầu gần đây.",
    "recentActivity": "Hoạt động gần đây",
    "openNotifications": "Mở thông báo",
    "unreadNotifications": "{count} thông báo chưa đọc",
    "noUnreadNotifications": "Không có thông báo chưa đọc.",
    "loadError": "Không thể tải dữ liệu tổng quan."
  },
  "notifications": {
    "loadError": "Không thể tải thông báo.",
    "empty": "Chưa có thông báo. Hoạt động yêu cầu và cập nhật trạng thái sẽ xuất hiện ở đây.",
    "unreadCount": "{count} chưa đọc",
    "marking": "Đang đánh dấu...",
    "markAllRead": "Đánh dấu tất cả đã đọc",
    "read": "Đã đọc",
    "unread": "Chưa đọc",
    "viewRequest": "Xem yêu cầu",
    "saving": "Đang lưu...",
    "markRead": "Đánh dấu đã đọc"
  },
  "admin": {
    "forbiddenTitle": "Bị chặn",
    "forbiddenDescription": "Chỉ lead có thể quản lý vai trò và quyền truy cập tài khoản.",
    "loadUsersErrorTitle": "Không thể tải người dùng",
    "noUsers": "Không tìm thấy người dùng.",
    "unnamed": "Chưa có tên",
    "name": "Tên",
    "email": "Email",
    "role": "Vai trò",
    "state": "Trạng thái",
    "access": "Truy cập",
    "created": "Ngày tạo",
    "savingRole": "Đang lưu vai trò...",
    "activeAccount": "Tài khoản hoạt động",
    "pendingApproval": "Đang chờ duyệt",
    "disabling": "Đang tắt...",
    "approving": "Đang duyệt...",
    "disable": "Tắt",
    "approve": "Duyệt",
    "roleUpdateError": "Không thể cập nhật vai trò người dùng này.",
    "accessUpdateError": "Không thể cập nhật trạng thái truy cập người dùng."
  }
}
```

- [ ] **Step 2: Translate dashboard page**

Use `useLocale`, `useTranslations("dashboard")`, and `translateStatus` / `translatePriority`. Change dashboard `formatDate(value)` to accept `locale` and use it in `Intl.DateTimeFormat(locale, ...)`. Replace labels with dashboard keys.

Keep request titles from API untouched.

- [ ] **Step 3: Translate notifications list**

Use `useLocale` and `useTranslations("notifications")`. Replace UI labels and use active locale for dates:

```tsx
{notificationsQuery.error instanceof Error ? notificationsQuery.error.message : t("loadError")}
{t("empty")}
{t("unreadCount", { count: unreadCount })}
{actions.markAllRead.isPending ? t("marking") : t("markAllRead")}
{notification.is_read ? t("read") : t("unread")}
{t("viewRequest")}
{actions.markRead.isPending ? t("saving") : t("markRead")}
```

- [ ] **Step 4: Translate admin user role table**

Use `useLocale`, `useTranslations("admin")`, and active locale for created dates. Replace all table headers, empty states, role save labels, account state labels, action button text, and frontend fallback errors.

Keep role values (`fe`, `be`, `lead`) in selects unchanged. Display role options as uppercase values for now.

- [ ] **Step 5: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/page.tsx apps/web/src/components/notifications/notification-list.tsx apps/web/src/components/admin/user-role-table.tsx apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: translate dashboard notifications admin"
```

### Task 7: Final Verification and Manual QA

**Files:**

- Modify: any file with missed hard-coded visible strings found during QA.

- [ ] **Step 1: Search for remaining visible English strings**

Use the Grep tool or run from repo root:

```bash
rg '"[A-Z][A-Za-z ,.:!?-]{3,}"|>[A-Z][A-Za-z ,.:!?-]{3,}<' apps/web/src
```

Expected: only acceptable technical strings remain, such as app name, import names, type names, raw API enum values, or metadata. Convert any missed visible UI strings to translations.

- [ ] **Step 2: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: exits with code 0.

- [ ] **Step 3: Run production build**

Run from `apps/web`:

```bash
npm run build
```

Expected: exits with code 0.

- [ ] **Step 4: Manual QA in Vietnamese default**

Run from `apps/web`:

```bash
npm run dev
```

Open the app and verify:

- First visit renders Vietnamese by default.
- `/login` uses Vietnamese copy.
- `/dashboard` uses Vietnamese navigation, summary cards, and activity labels.
- `/requests`, `/assigned`, `/pool`, `/done`, and `/all` page headers and empty states are Vietnamese.
- `/requests/new` form labels and validation errors are Vietnamese.
- Request detail labels, action dialogs, and timeline labels are Vietnamese.
- Notifications and admin users labels are Vietnamese.

- [ ] **Step 5: Manual QA language switch persistence**

In the running app:

- Switch to English with the topbar language switcher.
- Confirm the route does not change.
- Reload the page.
- Confirm English remains selected.
- Switch back to Vietnamese.
- Reload again.
- Confirm Vietnamese remains selected.

- [ ] **Step 6: Manual QA auth route safety**

Confirm:

- Supabase Google login still redirects to the callback route.
- The auth callback route is not locale-prefixed.
- Protected routes still redirect unauthenticated users according to existing middleware behavior.

- [ ] **Step 7: Detect changed execution flows before final handoff**

Run GitNexus change detection:

```txt
gitnexus_detect_changes({scope: "all", repo: "Team-Request-Hub"})
```

Expected: changed symbols are limited to frontend i18n, app shell, auth UI, request UI, notification UI, and admin UI flows.

- [ ] **Step 8: Commit final fixes**

```bash
git add apps/web docs/superpowers/specs/2026-05-22-bilingual-i18n-design.md docs/superpowers/plans/2026-05-22-bilingual-i18n-implementation.md
git commit -m "docs: plan bilingual frontend i18n"
```

Only make this commit if the user explicitly wants commits. If commits were already made per task, commit only remaining final fixes and docs.

## Self-Review

- Spec coverage: The plan covers Vietnamese default, English option, no URL prefixes, cookie persistence, frontend UI text, frontend-generated errors, raw backend error preservation, enum label translation, language switcher, and verification.
- Placeholder scan: No task uses unresolved placeholders. The only conditional instruction is `If auth-form is unused`, which includes the concrete action to leave behavior unchanged unless visible strings are still compiled/rendered.
- Type consistency: Locale type is `AppLocale`; cookie is `trh-locale`; message namespaces match the design; request enum helpers keep API values unchanged.
