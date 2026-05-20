# FE Setup: Request Management Tool

## Architecture

```
FE      Next.js 15 (repo này)
BE      FastAPI — repo riêng (xem SETUP_BE.md)
DB      Supabase (PostgreSQL + Auth + Realtime)
Deploy  FE → Vercel / BE → Railway hoặc Render
```

## Stack
- Next.js 15 App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Realtime (FE chỉ dùng Auth và Realtime, không query DB trực tiếp)
- TanStack Query v5 (gọi API vào FastAPI BE)
- shadcn/ui (Slate theme)
- Notification: chưa chốt channel (Discord / Telegram / Slack)
  - Dùng abstract adapter pattern
  - Dev fallback dùng console adapter

## Auth flow
```
FE login Google → Supabase trả JWT token
FE đính kèm JWT vào mọi request gửi lên FastAPI
FastAPI verify JWT với Supabase → xử lý và trả response
```

> Không dùng NextAuth. Không có Route Handlers trong Next.js.
> Mọi business logic nằm ở FastAPI BE.

---

## Context

Tool nội bộ để các thành viên trong team gửi request cho nhau.
Không chỉ giới hạn API request — có thể là bất kỳ yêu cầu nào.

Team vẫn dùng ClickUp để quản lý task chính. Tool này không thay ClickUp.

3 roles:
```
fe / fe intern   Tạo request, xem status, đọc reply
be / be intern   Thấy pool, tự nhận hoặc được assign, reply, update status
lead             Thấy tất cả, có thể reassign
```

---

## MVP Scope

Chỉ setup boilerplate FE, chưa implement business logic.

Core modules:
```
1. Auth          Google OAuth qua Supabase
2. Dashboard     My Tasks theo role
3. Request flow  Tạo → assign/pool → reply → done
4. Notification  Adapter pattern, chưa chốt provider
5. Catalog       Placeholder, mở rộng sau
```

Không làm trong MVP:
```
- Route Handlers / API trong Next.js (BE lo)
- File storage
- Comment thread (chỉ có 1 reply, nâng cấp sau)
- Catalog thật sự
```

---

## Task

Setup boilerplate FE. Project đã được init bằng `create-next-app` với:
```
TypeScript, Tailwind CSS, App Router, src-dir, import alias @/*
```

---

## Step 1 — Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query @tanstack/react-query-devtools
npx shadcn@latest init
```

shadcn config:
```
Style: Default
Base color: Slate
CSS variables: Yes
```

Install shadcn components:

```bash
npx shadcn@latest add button input label badge avatar
npx shadcn@latest add dropdown-menu dialog select textarea
npx shadcn@latest add toast card separator
```

---

## Step 2 — Folder structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx         # My Tasks theo role
│   │   ├── requests/
│   │   │   ├── page.tsx         # Danh sách request của tôi
│   │   │   └── new/
│   │   │       └── page.tsx     # Tạo request mới
│   │   ├── pool/
│   │   │   └── page.tsx         # Pool chung (BE thấy)
│   │   └── catalog/
│   │       └── page.tsx         # Placeholder, mở rộng sau
│   ├── layout.tsx
│   └── page.tsx                 # Redirect về /dashboard
├── components/
│   ├── ui/                      # shadcn components (auto-generated)
│   └── shared/                  # shared custom components
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # browser client (Auth + Realtime)
│   │   └── middleware.ts        # session refresh
│   ├── api/
│   │   └── client.ts            # fetch wrapper gọi vào FastAPI BE
│   ├── notifications/
│   │   ├── index.ts             # abstract sendNotification()
│   │   └── adapters/
│   │       ├── console.ts       # dev fallback
│   │       ├── discord.ts       # placeholder
│   │       └── telegram.ts      # placeholder
│   └── utils.ts
├── providers/
│   └── query-provider.tsx
├── types/
│   └── index.ts
└── middleware.ts
```

> Không có `src/app/api/` — không dùng Route Handlers.
> Không có `lib/supabase/server.ts` — FE không query DB trực tiếp.

---

## Step 3 — Supabase client (Auth + Realtime only)

### `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedRoutes = ['/dashboard', '/requests', '/pool', '/catalog']
  const isProtectedRoute = protectedRoutes.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

### `src/middleware.ts`

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## Step 4 — API client (gọi vào FastAPI BE)

### `src/lib/api/client.ts`

```typescript
import { createClient } from '@/lib/supabase/client'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!

async function getAuthHeaders() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

> Mọi request từ FE lên BE đều đính kèm JWT token của Supabase.
> FastAPI sẽ verify token này trước khi xử lý.

---

## Step 5 — Types

### `src/types/index.ts`

```typescript
export type Role = 'fe' | 'be' | 'lead'

export type RequestStatus =
  | 'pending'
  | 'acknowledged'
  | 'in_progress'
  | 'done'
  | 'cancelled'

export type NotificationType =
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'pool_new'
  | 'replied'
  | 'done'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: Role
  created_at: string
}

export interface Request {
  id: string
  title: string
  description: string
  reference_links: string[]
  status: RequestStatus
  created_by: string
  assigned_to?: string
  reply?: string                  // 1 reply từ assignee, nâng cấp lên comments sau
  acknowledged_at?: string
  started_at?: string
  done_at?: string
  cancelled_at?: string
  created_at: string
  updated_at: string
}

export interface AssignmentHistory {
  id: string
  request_id: string
  assigned_to: string
  assigned_by: string
  note?: string
  created_at: string
}

export interface RequestStatusLog {
  id: string
  request_id: string
  from_status?: RequestStatus
  to_status: RequestStatus
  changed_by: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  request_id?: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}
```

> Không có HttpMethod, ApiRequest, ApiCatalog.
> Request giờ là general, không API-specific.
> Catalog types sẽ thêm sau khi mở rộng.

---

## Step 6 — Notification adapter

### `src/lib/notifications/index.ts`

```typescript
import { ConsoleAdapter } from './adapters/console'

export type NotificationPayload = {
  to: string
  title: string
  message: string
  link?: string
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>
}

const adapter: NotificationAdapter = new ConsoleAdapter()

export async function sendNotification(payload: NotificationPayload) {
  await adapter.send(payload)
}
```

### `src/lib/notifications/adapters/console.ts`

```typescript
import type { NotificationAdapter, NotificationPayload } from '../index'

export class ConsoleAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload) {
    console.log('[Notification]', payload)
  }
}
```

### `src/lib/notifications/adapters/discord.ts`
### `src/lib/notifications/adapters/telegram.ts`

Tạo 2 file với class implement `NotificationAdapter`, body `// TODO: implement`.

---

## Step 7 — Query Provider

### `src/providers/query-provider.tsx`

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

---

## Step 8 — Root layout & redirect

### `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Request Tool',
  description: 'Internal request management tool',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

### `src/app/page.tsx`

```typescript
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
```

---

## Step 9 — Placeholder pages

### `src/app/(auth)/login/page.tsx`

```typescript
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Google OAuth placeholder
        </p>
      </div>
    </main>
  )
}
```

### `src/app/(dashboard)/dashboard/page.tsx`

```typescript
export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">My Tasks placeholder</p>
    </div>
  )
}
```

Tạo tương tự cho:
```
src/app/(dashboard)/requests/page.tsx
src/app/(dashboard)/requests/new/page.tsx
src/app/(dashboard)/pool/page.tsx
src/app/(dashboard)/catalog/page.tsx
```

---

## Step 10 — Dashboard layout

### `src/app/(dashboard)/layout.tsx`

```typescript
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <main className="min-h-screen bg-background">{children}</main>
}
```

---

## Step 11 — Env files

### `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
# NOTIFICATION_WEBHOOK_URL=   # thêm sau khi chốt channel
```

### `.env.example`

Cùng keys, value để trống.

> Không có SUPABASE_SERVICE_ROLE_KEY ở FE.
> Không có RESEND_API_KEY.

---

## Step 12 — Kiểm tra

```bash
npm run dev
```

Đảm bảo:
```
localhost:3000        → redirect /dashboard → redirect /login
/login                → hiện placeholder
Không lỗi TypeScript
Không lỗi import
shadcn components hoạt động
TanStack Query Provider hoạt động
```

---

## Constraints

- Không tạo src/app/api/ — không dùng Route Handlers
- Không query Supabase DB trực tiếp từ FE — gọi qua FastAPI BE
- Không install thêm package ngoài danh sách
- Không implement business logic thật
- Không hardcode env values
- Sau khi xong, list toàn bộ file đã tạo/chỉnh sửa

---

## Expected output

```
Created:
- src/lib/supabase/client.ts
- src/lib/supabase/middleware.ts
- src/lib/api/client.ts
- src/lib/notifications/index.ts
- src/lib/notifications/adapters/console.ts
- src/lib/notifications/adapters/discord.ts
- src/lib/notifications/adapters/telegram.ts
- src/lib/utils.ts
- src/providers/query-provider.tsx
- src/types/index.ts
- src/app/page.tsx
- src/app/(auth)/login/page.tsx
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/dashboard/page.tsx
- src/app/(dashboard)/requests/page.tsx
- src/app/(dashboard)/requests/new/page.tsx
- src/app/(dashboard)/pool/page.tsx
- src/app/(dashboard)/catalog/page.tsx
- src/middleware.ts
- .env.example

Modified:
- src/app/layout.tsx
- .env.local
```