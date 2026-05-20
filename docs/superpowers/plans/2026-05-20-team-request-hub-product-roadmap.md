# Team Request Hub Product Roadmap

Use this roadmap to finish the product phase by phase. Each phase should be run as a separate work session. Before starting a phase, open the implementation plan:

```txt
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

That file contains the concrete tasks, files, code snippets, commands, and verification steps.

## Product Completion Definition

The MVP is complete when:

```txt
- A user can sign in with Google through Supabase Auth.
- New users get a public.users profile with role fe by default.
- Backend verifies Supabase JWTs and loads roles from DB.
- Lead users can update roles for other users.
- Users can create internal requests.
- Users can view assigned, created, pool, done, and lead-only all request views.
- Users can self-assign pool requests.
- Assignees/leads can acknowledge, start, and complete requests with reply.
- Creators/leads can cancel requests.
- Reassign, status, done, cancel, and assignment actions create audit records.
- Notifications are created by backend and visible in frontend.
- FE never queries Supabase DB directly.
- BE tests pass.
- FE lint and build pass.
```

## Phase Order

## Per-Phase Planning Rule

Before executing any phase, create a phase-specific implementation plan. Do not
write production code during this planning step.

For frontend phases, also read:

```txt
docs/frontend-ui-framework.md
```

Save the phase plan as:

```txt
docs/superpowers/plans/YYYY-MM-DD-phase-N-<phase-name>-detail.md
```

Each phase plan must be based on the current repository state and include:

```txt
- phase goal
- in-scope work
- out-of-scope work
- files to create or modify
- task order
- TDD points
- verification commands
- done criteria
- known risks or blockers
```

Recommended planning prompt:

```txt
Lập plan chi tiết cho Phase N từ docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md.
Chưa code.
Hãy đọc trạng thái repo hiện tại, đối chiếu với docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md, rồi tạo file plan riêng cho phase này.
Plan phải có: mục tiêu, files sẽ sửa/tạo, thứ tự task, test/verify commands, done criteria, risks/blockers, và out-of-scope.
```

Recommended execution prompt after approving the phase plan:

```txt
Execute Phase N theo file plan chi tiết vừa tạo.
Làm đúng scope phase, không làm sang phase khác.
Chạy verify cuối phase và báo file changed + risk còn lại.
```

---

### Phase 1: Backend Stabilization

**Goal:** Make backend workflow reliable before building frontend deeply.

**Main tasks:**

```txt
- Add route-level test for lead-only role update.
- Add request workflow service tests with mocked repositories.
- Verify side effects for assignment_history, request_status_logs, notifications.
- Run backend import and compile checks.
```

**Files likely touched:**

```txt
apps/api/tests/test_users_routes.py
apps/api/tests/test_request_service_workflow.py
apps/api/app/services/request_service.py
apps/api/app/routes/users.py
```

**Done when:**

```txt
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Both pass.

**Suggested prompt to run later:**

```txt
Execute Phase 1 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Use TDD, keep changes scoped, and verify with uv tests.
```

---

### Phase 2: Auth UI

**Goal:** Make login/logout real and establish current-user loading in FE.

**Main tasks:**

```txt
- Implement Google OAuth login button.
- Replace login placeholder.
- Add current user API client and hook.
- Add logout button.
```

**Files likely touched:**

```txt
apps/web/src/app/(auth)/login/page.tsx
apps/web/src/components/auth/google-login-button.tsx
apps/web/src/components/auth/logout-button.tsx
apps/web/src/lib/api/users.ts
apps/web/src/hooks/use-current-user.ts
```

**Done when:**

```txt
cd apps/web
npm run lint
npm run build
```

Both pass, and browser flow reaches Supabase Google OAuth.

**Suggested prompt to run later:**

```txt
Execute Phase 2 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Build the real Google login/logout UI and verify lint/build.
```

---

### Phase 3: Frontend Data Layer And App Shell

**Goal:** Create reusable FE data access and dashboard shell before feature pages.

**Main tasks:**

```txt
- Add API clients for requests.
- Add query keys.
- Add request list and action hooks.
- Add dashboard app shell with navigation and current user display.
```

**Files likely touched:**

```txt
apps/web/src/lib/api/query-keys.ts
apps/web/src/lib/api/requests.ts
apps/web/src/hooks/use-requests.ts
apps/web/src/hooks/use-request-actions.ts
apps/web/src/components/app/app-shell.tsx
apps/web/src/app/(dashboard)/layout.tsx
```

**Done when:**

```txt
cd apps/web
npm run lint
npm run build
```

Both pass, and dashboard layout shows navigation after login.

**Suggested prompt to run later:**

```txt
Execute Phase 3 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Add FE API clients, hooks, and dashboard shell.
```

---

### Phase 4: Request List And Create UI

**Goal:** Let users create requests and view request lists by backend view.

**Main tasks:**

```txt
- Build request card and list components.
- Wire assigned, created, pool, done, and all pages to API views.
- Build create request form.
```

**Files likely touched:**

```txt
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-list.tsx
apps/web/src/components/requests/request-form.tsx
apps/web/src/app/(dashboard)/assigned/page.tsx
apps/web/src/app/(dashboard)/requests/page.tsx
apps/web/src/app/(dashboard)/requests/new/page.tsx
apps/web/src/app/(dashboard)/pool/page.tsx
apps/web/src/app/(dashboard)/done/page.tsx
apps/web/src/app/(dashboard)/all/page.tsx
```

**Done when:**

```txt
cd apps/web
npm run lint
npm run build
```

Both pass, and a logged-in user can create a request and see it in Created by me.

**Suggested prompt to run later:**

```txt
Execute Phase 4 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Build request list pages and create request form.
```

---

### Phase 5: Request Actions

**Goal:** Complete the core request workflow from the UI.

**Main tasks:**

```txt
- Add self-assign action.
- Add acknowledge action.
- Add start action.
- Add cancel action.
- Add done action with required reply.
- Ensure buttons are role/status aware.
```

**Files likely touched:**

```txt
apps/web/src/components/requests/request-actions.tsx
apps/web/src/components/requests/done-dialog.tsx
apps/web/src/components/requests/request-card.tsx
```

**Done when:**

```txt
cd apps/web
npm run lint
npm run build
```

Both pass, and manual workflow works:

```txt
create -> self-assign -> acknowledge -> start -> done
```

**Suggested prompt to run later:**

```txt
Execute Phase 5 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Add role/status-aware request action UI.
```

---

### Phase 6: Lead Admin And Notifications

**Goal:** Finish lead role management and in-app notifications.

**Main tasks:**

```txt
- Add user list hook.
- Add lead-only role management page.
- Add notifications API client.
- Add notification hook and list.
- Add mark-read and read-all actions.
```

**Files likely touched:**

```txt
apps/web/src/hooks/use-users.ts
apps/web/src/components/users/role-management-table.tsx
apps/web/src/app/(dashboard)/admin/users/page.tsx
apps/web/src/lib/api/notifications.ts
apps/web/src/hooks/use-notifications.ts
apps/web/src/components/notifications/notification-list.tsx
apps/web/src/app/(dashboard)/dashboard/page.tsx
```

**Done when:**

```txt
cd apps/web
npm run lint
npm run build
```

Both pass, lead can update roles, and notifications are visible/readable.

**Suggested prompt to run later:**

```txt
Execute Phase 6 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Add lead role management and notifications UI.
```

---

### Phase 7: Full End-To-End Verification

**Goal:** Prove the MVP works with real Supabase configuration.

**Main tasks:**

```txt
- Apply DB_SCHEMA_TEAM_REQUEST_HUB.sql in Supabase.
- Start backend with real .env.
- Start frontend with real .env.local.
- Test login.
- Test request create/list/actions.
- Test notifications.
- Test lead role update.
- Update docs with final implementation state.
```

**Done when:**

```txt
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

```txt
cd apps/web
npm run lint
npm run build
```

All pass, and manual smoke test is complete.

**Suggested prompt to run later:**

```txt
Execute Phase 7 from docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md. Run full backend/frontend verification, real Supabase smoke test, and update docs.
```

---

## Recommended Time Slices

Use one work session per phase.

```txt
Session 1: Phase 1
Session 2: Phase 2
Session 3: Phase 3
Session 4: Phase 4
Session 5: Phase 5
Session 6: Phase 6
Session 7: Phase 7
```

If a phase runs long, stop only after:

```txt
- tests/checks for completed tasks pass
- current changes are summarized
- unfinished task is clearly marked
```

## Execution Rule

At the start of each session, paste the phase prompt from this file. The worker should:

```txt
1. Read this roadmap.
2. Open the detailed implementation plan.
3. Execute only the requested phase.
4. Run the phase verification commands.
5. Summarize files changed and remaining risks.
```
