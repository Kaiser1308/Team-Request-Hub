# FE Setup: Team Request Hub

## Architecture

```txt
FE      Next.js 15 + TypeScript + Tailwind + shadcn
BE      FastAPI — repo/folder riêng, xem SETUP_BE.md
DB      Supabase PostgreSQL + Auth + Realtime
Deploy  FE → Vercel / BE → Railway hoặc Render
```

---

## Product Scope

**Team Request Hub** là tool nội bộ để mọi thành viên trong team tạo request nhỏ cho nhau.

Không còn là API Request Management Tool thuần.

Tool này dùng để xử lý các request nhỏ dễ bị trôi qua chat:

```txt
FE → BE
BE → FE
BE → BE
Lead → FE/BE
FE/BE → Lead
```

Tool này **không thay ClickUp**. ClickUp vẫn dùng cho task chính, sprint, roadmap. Team Request Hub chỉ quản lý request nhỏ cần tracking rõ:

```txt
Ai tạo?
Ai đang giữ?
Trạng thái tới đâu?
Kết quả cuối là gì?
```

---

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth + Realtime
- TanStack Query v5
- FastAPI backend API client

FE chỉ dùng Supabase cho:

```txt
Auth
Realtime listener
Session/JWT
```

FE không query database trực tiếp.

---

## Auth Flow

```txt
User login Google ở FE
↓
Supabase Auth trả session + JWT
↓
FE gọi FastAPI bằng Bearer JWT
↓
FastAPI verify JWT với Supabase
↓
FastAPI xử lý business logic + permission
↓
FastAPI trả response cho FE
```

Không dùng:

```txt
NextAuth
Next.js Route Handlers
src/app/api
Supabase DB query trực tiếp từ FE
```

---

## Roles

```ts
export type Role = 'fe' | 'be' | 'lead'
```

Intern không có role riêng. Intern được map vào `fe` hoặc `be`.

Role behavior:

```txt
fe    Tạo request, nhận request, assign, self-assign, update request mình giữ
be    Tạo request, nhận request, assign, self-assign, update request mình giữ
lead  Thấy tất cả, reassign/cancel/override khi cần
```

---

## Core Business Rules

```txt
1. Mọi role đều tạo request được.
2. Request có thể assign trực tiếp cho một user hoặc để vào pool.
3. assigned_to = null nghĩa là request nằm trong pool.
4. Mọi role đều có thể self-assign từ pool.
5. FE có thể assign request cho BE/FE/Lead.
6. BE có thể assign request cho FE/BE/Lead.
7. Creator có thể reassign request mình tạo nếu chưa done/cancelled.
8. Assignee có thể reassign request đang assigned cho mình.
9. Lead có thể reassign mọi request.
10. Reassign từ pending giữ status pending.
11. Reassign từ acknowledged/in_progress reset về pending và bắt buộc có reason.
12. Done bắt buộc có reply.
13. Cancelled chỉ creator hoặc lead được làm.
14. Tags chỉ dùng để phân loại, không tạo schema cứng theo task type.
```

---

## MVP Scope

FE boilerplate gồm:

```txt
1. Auth placeholder
2. Dashboard layout
3. Request list pages
4. Create request page
5. Pool page
6. Notification-ready structure
7. API client gọi FastAPI
8. Types FE
```

Không implement business logic thật trong bước setup.

Không làm trong MVP setup:

```txt
- src/app/api
- Next.js Route Handlers
- File storage
- Comment thread
- Catalog thật
- Slack/Discord/Telegram notification thật
- DB query trực tiếp từ FE
```

---

## Task

Setup boilerplate FE.

Project đã được init bằng `create-next-app` với:

```txt
TypeScript
Tailwind CSS
App Router
src-dir
import alias @/*
```

---

## Step 1 — Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query @tanstack/react-query-devtools
npx shadcn@latest init
```

shadcn config:

```txt
Style: Default hoặc preset đang chọn
Base color: Slate nếu có hỏi
CSS variables: Yes
```

Install shadcn components:

```bash
npx shadcn@latest add button input label badge avatar
npx shadcn@latest add dropdown-menu dialog select textarea
npx shadcn@latest add toast card separator
```

---

## Step 2 — Folder Structure

Tạo cấu trúc sau trong `src/`:

```txt
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Dashboard overview
│   │   ├── requests/
│   │   │   ├── page.tsx              # Created by me / request list
│   │   │   └── new/
│   │   │       └── page.tsx          # Create request
│   │   ├── assigned/
│   │   │   └── page.tsx              # Assigned to me
│   │   ├── pool/
│   │   │   └── page.tsx              # Unassigned requests
│   │   ├── done/
│   │   │   └── page.tsx              # Done requests
│   │   └── all/
│   │       └── page.tsx              # Lead only placeholder
│   ├── layout.tsx
│   └── page.tsx                      # Redirect to /dashboard
├── components/
│   ├── ui/                           # shadcn components
│   └── shared/                       # shared custom components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Supabase browser client
│   │   └── middleware.ts             # Session refresh + route guard
│   ├── api/
│   │   └── client.ts                 # Fetch wrapper gọi FastAPI
│   └── utils.ts
├── providers/
│   └── query-provider.tsx
├── types/
│   └── index.ts
└── middleware.ts
```

Hard constraints:

```txt
Không tạo src/app/api/
Không tạo lib/supabase/server.ts trong FE setup này
Không tạo notification adapter thật ở FE
```

Notification thật sẽ nằm ở FastAPI backend. FE chỉ hiển thị notification và lắng nghe realtime sau này.

---

## Step 3 — Supabase Client

### `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## Step 4 — Supabase Middleware

### `src/lib/supabase/middleware.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoutes = [
    '/dashboard',
    '/requests',
    '/assigned',
    '/pool',
    '/done',
    '/all',
  ]

  const isProtectedRoute = protectedRoutes.some((path) =>
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

```ts
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

## Step 5 — FastAPI Client

### `src/lib/api/client.ts`

```ts
import { createClient } from '@/lib/supabase/client'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!

async function getAuthHeaders() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Unauthorized')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }

  return res.json() as Promise<T>
}
```

---

## Step 6 — FE Types

### `src/types/index.ts`

```ts
export type Role = 'fe' | 'be' | 'lead'

export type RequestStatus =
  | 'pending'
  | 'acknowledged'
  | 'in_progress'
  | 'done'
  | 'cancelled'

export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent'

export type NotificationType =
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'pool_new'
  | 'replied'
  | 'done'
  | 'cancelled'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: Role
  created_at: string
}

export interface InternalRequest {
  id: string
  title: string
  description: string
  tags: string[]
  priority: RequestPriority
  status: RequestStatus
  created_by: string
  assigned_to?: string | null
  reference_links: string[]
  reply?: string | null
  acknowledged_at?: string | null
  started_at?: string | null
  done_at?: string | null
  cancelled_at?: string | null
  created_at: string
  updated_at: string
}

export interface AssignmentHistory {
  id: string
  request_id: string
  from_user_id?: string | null
  to_user_id: string
  assigned_by: string
  reason?: string | null
  created_at: string
}

export interface RequestStatusLog {
  id: string
  request_id: string
  from_status?: RequestStatus | null
  to_status: RequestStatus
  changed_by: string
  reason?: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  request_id?: string | null
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}
```

Important:

```txt
Không dùng interface Request vì dễ đụng native Fetch Request.
Không dùng ApiRequest vì scope không còn API-specific.
Không dùng HttpMethod trong core type.
Không dùng ApiCatalog trong MVP FE setup.
```

---

## Step 7 — Query Provider

### `src/providers/query-provider.tsx`

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
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

## Step 8 — Root Layout

### `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Team Request Hub',
  description: 'Internal request workflow tool for team coordination',
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

---

## Step 9 — Root Redirect

### `src/app/page.tsx`

```tsx
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
```

---

## Step 10 — Placeholder Pages

### `src/app/(auth)/login/page.tsx`

```tsx
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Team Request Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Google OAuth placeholder
        </p>
      </div>
    </main>
  )
}
```

### `src/app/(dashboard)/layout.tsx`

```tsx
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <main className="min-h-screen bg-background">{children}</main>
}
```

### `src/app/(dashboard)/dashboard/page.tsx`

```tsx
export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Team request overview placeholder
      </p>
    </div>
  )
}
```

Tạo tương tự cho:

```txt
src/app/(dashboard)/requests/page.tsx
src/app/(dashboard)/requests/new/page.tsx
src/app/(dashboard)/assigned/page.tsx
src/app/(dashboard)/pool/page.tsx
src/app/(dashboard)/done/page.tsx
src/app/(dashboard)/all/page.tsx
```

Suggested page titles:

```txt
/requests      Created by me
/requests/new  Create request
/assigned      Assigned to me
/pool          Pool
/done          Done
/all           All requests
```

---

## Step 11 — Env Files

### `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `.env.example`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

Do not include in FE:

```txt
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
DISCORD_WEBHOOK_URL
TELEGRAM_BOT_TOKEN
SLACK_WEBHOOK_URL
```

Secrets for notification providers belong to FastAPI backend.

---

## Step 12 — Check

Run:

```bash
npm run dev
```

Expected:

```txt
localhost:3000 → /dashboard → /login if unauthenticated
/login renders placeholder
No TypeScript error
No import error
No src/app/api folder
TanStack Query Provider works
Supabase middleware works
```

---

## Constraints

```txt
- Do not create src/app/api/
- Do not query Supabase DB directly from FE
- Do not create lib/supabase/server.ts in FE setup
- Do not implement business logic in FE
- Do not hardcode env values
- Do not install extra packages outside listed dependencies
- Do not create notification provider secrets in FE
- After setup, list all created/modified files
```

---

## Expected Output

```txt
Created:
- src/lib/supabase/client.ts
- src/lib/supabase/middleware.ts
- src/lib/api/client.ts
- src/lib/utils.ts
- src/providers/query-provider.tsx
- src/types/index.ts
- src/app/page.tsx
- src/app/(auth)/login/page.tsx
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/dashboard/page.tsx
- src/app/(dashboard)/requests/page.tsx
- src/app/(dashboard)/requests/new/page.tsx
- src/app/(dashboard)/assigned/page.tsx
- src/app/(dashboard)/pool/page.tsx
- src/app/(dashboard)/done/page.tsx
- src/app/(dashboard)/all/page.tsx
- src/middleware.ts
- .env.example

Modified:
- src/app/layout.tsx
- .env.local
```

---

## Next Step After FE Setup

Sau khi FE boilerplate xong:

```txt
1. Viết SETUP_BE.md cho FastAPI
2. Viết BUSINESS_RULES.md
3. Viết API_CONTRACT.md
4. Làm wireframe UI
```
