# Strict Testing Strategy Design

## Goal

Build a strict but maintainable testing strategy for Team Request Hub. The test suite should give confidence that role permissions, request workflows, notifications, files, and critical UI journeys work before changes ship.

The first target is a reliable local workflow. CI integration comes later after the local workflow is stable.

## Scope

This design covers frontend, backend, API integration, E2E, test data, and Supabase branch usage.

It does not require exhaustive E2E coverage for every edge case. Business rules and permissions should be tested mostly at the backend/API layer, while E2E should cover the highest-value user journeys.

## Environment Strategy

Use a Supabase branch created from the current project as the dedicated test database environment.

Local tests must use test-specific environment files and must not use production or staging `.env.local` values. Secrets must not be committed.

Required safety rules:

- Test data uses a clear prefix such as `e2e_` or dedicated test email domains.
- Destructive tests only run when the app environment explicitly identifies itself as test, such as `APP_ENV=test` or `ENVIRONMENT=test`.
- Seed and reset scripts target only the Supabase branch.
- Frontend and backend test environment variables must point at the Supabase branch and test API URL.

## Test Data Model

The test branch should be seeded with stable fixtures:

| Fixture group | Required examples |
| --- | --- |
| Users | `fe.active`, `be.active`, `lead.active`, `fe.inactive` |
| Requests | pending unassigned, assigned to BE, created by FE, done request, cancelled request |
| Assignment history | entries for request detail coverage |
| Status logs | entries for request detail coverage |
| Notifications | read and unread notifications for each role |
| Files | one or two files or folders if storage testing is configured |

The seed data must be deterministic so that tests can run repeatedly without depending on execution order.

## Test Layers

### Backend Unit And Service Tests

Backend tests should cover business rules directly where possible because they are faster and less flaky than browser tests.

Primary areas:

- Role checks for `fe`, `be`, and `lead`.
- Request status transition rules.
- Assignment, self-assignment, reassignment, add-assignee, and remove-assignee rules.
- Done reply and cancellation rules.
- Notification record creation rules.
- Permission helper behavior.

The initial command remains:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

### Backend API Integration Tests

API integration tests should verify endpoint behavior against the Supabase branch.

Primary endpoint groups:

- `/health`
- `/users/me`, `/users/active`, `/users`, `/users/{user_id}/role`, `/users/{user_id}/active`
- `/requests` list/create/detail/update views
- `/requests/{request_id}/self-assign`
- `/requests/{request_id}/reassign`
- `/requests/{request_id}/status`
- `/requests/{request_id}/done`
- `/requests/{request_id}/cancel`
- `/requests/{request_id}/assignees`
- `/requests/{request_id}/assignment-history`
- `/requests/{request_id}/status-logs`
- `/notifications`, read-one, read-all, read-by-type
- `/dashboard`
- `/files` presigned upload/list/delete flows when storage test setup is ready

Allowed cases must return success and expected response shapes. Forbidden cases must return the expected failure, usually `403`, and must not mutate data.

### Frontend Integration Tests

Frontend integration tests are secondary to API and E2E in the first phase. They become valuable once the test runner is selected.

Priority areas:

- Request form validation.
- Request list loading, empty, and error states.
- Role/status-specific action visibility.
- API client error handling.
- Notification state updates.

### E2E Playwright Tests

E2E tests should cover only critical user journeys and browser-visible behavior.

Initial E2E flows:

- Login page smoke: app renders, Google button is visible and enabled.
- Pending approval: inactive user lands on the pending approval page.
- Dashboard smoke: sidebar, header, and main stats render.
- Create request: active user creates a request and sees it in the created list.
- Pool/self-assign: unassigned request appears in pool and can be self-assigned.
- Status workflow: request moves through acknowledged, in progress, and done states.
- Request detail: assignees, history, status logs, and available actions render correctly.
- Lead admin: lead can approve users and change role; FE/BE users cannot access lead-only actions.
- Notifications: user can mark notifications read.
- Files smoke: files page opens, and upload/list behavior is tested only if test storage is configured.

E2E tests should use user-visible selectors first, such as roles, labels, and button names. Add `data-testid` only for stable selectors that are otherwise hard to identify.

Screenshots are useful for debugging and visual smoke checks, but assertions must be based on expected behavior and visible UI state.

## Role Test Matrix

| Feature | `fe` | `be` | `lead` |
| --- | --- | --- | --- |
| Login as approved user | Yes | Yes | Yes |
| Pending approval as inactive user | Yes | Yes | Yes |
| View dashboard | Yes | Yes | Yes |
| Create request | Yes | Yes | Yes |
| View created requests | Yes | Yes | Yes |
| View assigned requests | If assigned | Yes | Yes |
| Pool/self-assign | If active | Yes | Yes |
| All requests | Forbidden | Forbidden | Yes |
| Role management | Forbidden | Forbidden | Yes |
| User approval | Forbidden | Forbidden | Yes |
| Status transitions | Limited | Assignee rules | Yes |
| Done/cancel | Creator or assignee rules | Assignee rules | Yes |
| Files | Current app permissions | Current app permissions | Current app permissions |
| Notifications | Own only | Own only | Own only |

Forbidden UI cases should be checked in two ways where practical:

- The UI should hide or disable unavailable actions.
- Direct backend calls should still be rejected.

## Local Commands

Initial verification commands:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests

cd apps/web
npm run lint
npm run build
npx playwright test --reporter=list
```

Once scripts are stabilized, add package scripts such as:

```bash
cd apps/web
npm run test:e2e
npm run test:e2e:report
```

## Pass Criteria

The suite passes when:

- Backend tests pass completely.
- Frontend lint and build pass.
- E2E critical journeys pass on Chromium.
- Role-forbidden paths fail safely.
- Tests do not depend on execution order.
- Tests do not write to real data.
- Test data can be reset or reseeded deterministically.

## Fail Criteria

The suite fails when:

- An assertion fails.
- An API endpoint returns the wrong status code or response shape.
- A role-forbidden action succeeds.
- A required user-visible UI element does not render.
- Test setup points at non-test environment values.
- Seed data is missing, ambiguous, or cannot be reset safely.

## Implementation Phases

1. Add test environment documentation and env templates.
2. Create Supabase branch setup and seed/reset workflow.
3. Expand backend unit and API integration tests.
4. Harden the existing Playwright setup and login smoke tests.
5. Add role-based and request workflow E2E tests.
6. Add frontend integration tests for forms and state handling.
7. Add CI after local commands are stable.

## Open Decisions For Implementation Planning

- Whether to use Python `unittest` only or introduce `pytest` for backend tests.
- Whether frontend integration tests should use Vitest and Testing Library.
- How test auth sessions should be generated for Supabase branch users.
- Whether file/storage E2E should be included in the first implementation phase or gated behind storage test setup.
