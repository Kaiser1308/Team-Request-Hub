# Architecture Optimization Roadmap Design

Date: 2026-05-31

## Purpose

Improve Team Request Hub's backend, database, notification, file, and frontend architecture without a high-risk rewrite. The roadmap prioritizes correctness and measurable baselines first, then deepens modules and seams in phases.

The central goals are:

- Make `request_assignees` the consistent source of truth for assignment behavior.
- Improve request list and dashboard query correctness for multi-assignee workflows.
- Reduce the size and responsibility spread of `request_service.py`.
- Keep route modules as HTTP adapters instead of workflow coordinators.
- Concentrate file path/tree invariants in a deep module.
- Move frontend contract behavior into view adapters instead of UI modules.

## Non-Goals

- No API contract rewrite unless a phase exposes an existing bug that must be corrected.
- No removal of `internal_requests.assigned_to` until compatibility and data safety are verified.
- No frontend visual redesign.
- No replacement of Supabase, FastAPI, Next.js, TanStack Query, or MinIO.

## Guiding Principles

- Make the smallest correct change in each phase.
- Add tests before or alongside behavior changes.
- Keep compatibility fallback in one module instead of many callers.
- Prefer deeper read models over repeated app-side enrichment.
- Use Postgres for relationship filtering when Supabase query builder semantics become shallow.
- Update docs when a seam or source-of-truth changes.

## Phase 0: Baseline

Goal: establish verification and current behavior before refactoring.

Work:

- Run backend unit tests from `apps/api`.
- Run frontend `npm run lint` and `npm run build` from `apps/web` when frontend code is touched.
- Identify current test gaps around assignment, dashboard, status transitions, notifications, and file tree operations.
- Record important flows to protect: request list, dashboard summary, request detail, request actions, notification delivery, and file operations.

Expected result:

- Known pass/fail state.
- Clear list of tests needed by later phases.
- No intentional behavior change.

## Phase 1: Assignment Source-Of-Truth

Goal: concentrate assignment representation knowledge behind one backend module.

Current friction:

- Docs say `request_assignees` is the current assignment source of truth.
- Code still checks `assigned_to`, `assignees`, and `assignee_ids` in multiple modules.
- Permission, dashboard, list, and detail behavior can drift for multi-assignee requests.

Design:

- Add a backend internal module such as `RequestAssignmentReadModel`.
- The interface should cover:
  - `get_assignee_ids(request_id)`
  - `get_assignee_ids_by_request_ids(request_ids)`
  - `normalize_request_assignments(request)`
  - `is_assigned_to_user(request, user_id)`
  - `has_current_assignees(request)`
- Keep compatibility fallback to `internal_requests.assigned_to` only inside this module.
- Update `permissions.py`, `dashboard.py`, `request_service.py`, and request repositories to depend on the module instead of inspecting raw assignment shape.

Tests:

- Request with only `assigned_to`.
- Request with only `request_assignees`.
- Request with both representations.
- Request with no assignee.
- Multi-assignee permission and dashboard cases.

Expected result:

- Assignment locality improves.
- Dashboard, permissions, and request views interpret assignments consistently.
- Phase 2 can optimize queries against a stable assignment seam.

## Phase 2: Request List And Dashboard Read Models

Goal: improve query correctness and performance for request list and dashboard flows.

Current friction:

- Some list views require multiple round trips.
- Pool logic can rely on app-side `NOT IN` behavior.
- Dashboard still depends on `assigned_to` semantics.
- Applying `limit` before final filtering can produce surprising results.

Design:

- Create or deepen read model modules such as `RequestListReadModel` and `DashboardReadModel`.
- Read models should use Phase 1 assignment semantics.
- Assigned view should filter through `request_assignees.user_id`.
- Pool view should mean no current assignee, preferably with `NOT EXISTS` if implemented through SQL view/RPC.
- Done view should define creator, assignee, and lead behavior explicitly.
- Dashboard counts should match request list semantics.
- If Supabase query builder cannot express a query cleanly, use a Postgres view or RPC.
- Verify or add indexes for:
  - `request_assignees(user_id, assigned_at desc)`
  - `request_assignees(request_id, assigned_at)`
  - `internal_requests(status, created_at desc)`
  - `internal_requests(created_by, created_at desc)`
  - `notifications(user_id, is_read, created_at desc)`

Tests:

- Assigned, created, pool, done, and all views.
- Multi-assignee request appears in each assignee's assigned view.
- Pool excludes any currently assigned request.
- Dashboard counts match list semantics.
- Lead and non-lead behavior is explicit.

Expected result:

- Fewer app-side joins and filters.
- Correct multi-assignee behavior.
- Query semantics live closer to the data seam.

## Phase 3: Request Workflow Deepening

Goal: reduce `request_service.py` responsibility without changing route behavior.

Current friction:

- `request_service.py` contains permission orchestration, assignment rules, status transitions, audit logs, notification side effects, user enrichment, and lifecycle timestamps.
- The public interface is useful, but the implementation has poor locality.

Design:

- Keep existing routes and response shapes stable.
- Move internal behavior into deeper modules:
  - `RequestTransitionEngine` for status rules, lifecycle timestamps, done and cancel transitions.
  - `RequestAssignmentEngine` for create-with-assignee, self-assign, reassign, add assignee, and remove assignee rules.
  - `RequestReadModelBuilder` for user and assignee enrichment.
  - `RequestSideEffectPlanner` for assignment history, status logs, notification intent, and other workflow side effects.
- Keep `request_service.py` as the orchestration module that coordinates these modules.

Tests:

- Status transition matrix.
- Done and cancel permissions.
- Reassign behavior, including active request reset rules.
- Assignment history and status logs.
- Notification intent generation.

Expected result:

- Workflow rule bugs concentrate in smaller modules.
- Tests can target pure or mostly pure interfaces.
- Phase 4 can move notification delivery concerns behind a better seam.

## Phase 4: Notification Event Publishing Seam

Goal: make `notification_module` own request notification events end to end.

Current friction:

- `request_service.py` creates notification records.
- `routes/requests.py` can still coordinate background delivery and recipient details.
- HTTP routes know too much about workflow side effects.

Design:

- Add an event-based interface such as `publish_request_event(event_type, request, actor, recipients, context)`.
- The notification module should own:
  - notification record creation,
  - message/template selection,
  - channel preference checks,
  - delivery record creation or delivery job planning,
  - Telegram, Email, and Web Push adapter calls.
- `request_service.py` should publish event intent through the side-effect planner.
- `routes/requests.py` should schedule only opaque jobs if background execution is still needed.
- Existing notification endpoints remain unchanged.

Tests:

- Assignment and reassignment create correct records.
- Channel preferences are respected.
- Routes do not derive recipients or delivery internals.
- Telegram, Email, and Web Push adapters remain behind the notification module interface.

Expected result:

- Notification event mapping has better locality.
- Adding a channel or event type has more leverage.
- Routes are closer to pure HTTP adapters.

## Phase 5: FileTree And File Operation Correctness

Goal: make file path and subtree behavior explicit and testable.

Current friction:

- `file_service.py` mixes path normalization, validation, MinIO operations, activity logging, permissions, and tree mutations.
- Folder move/rename/delete/restore behavior depends on path invariants that are not isolated.
- Prefix matching must avoid false descendants such as `/foo` matching `/foobar`.

Design:

- Add a deep module such as `FileTree`.
- The interface should cover:
  - `normalize_path(path)`
  - `validate_name(name)`
  - `child_path(parent_path, name)`
  - `descendant_prefix(path)`
  - `assert_can_move(source, destination)`
  - `plan_rename_subtree(file, new_name)`
  - `plan_move_subtree(file, new_parent_path)`
- Repository operations should express filesystem intent:
  - `rename_subtree(...)`
  - `move_subtree(...)`
  - `path_exists_active_or_deleted(...)`
- Use Postgres RPC transactions if consistency cannot be preserved through separate Supabase calls.
- Verify or add a unique partial index for non-purged paths if the schema does not already enforce it.

Tests:

- Root and nested path normalization.
- `/foo` does not match `/foobar` as a descendant.
- Folder rename updates descendant paths.
- Folder move prevents cycles.
- Duplicate paths are rejected.
- Soft-delete, restore, and purge preserve path invariants.

Expected result:

- File path bugs concentrate in `FileTree`.
- Rename, move, copy, delete, restore, and purge share one set of semantics.
- Risk of `team_files` path corruption is reduced.

## Phase 6: Frontend Request View Adapters

Goal: move backend contract behavior out of UI modules and into frontend adapters.

Current friction:

- The frontend keeps the important Supabase/auth seam clean.
- Request UI modules still know request views, filters, `403` behavior, limits, CTA behavior, and query invalidation details.

Design:

- Add or deepen view-model hooks/adapters such as:
  - `useRequestListView(view)`
  - `useRequestActions(request)`
  - `useNotificationView()` if notification UI behavior grows.
- Adapters should own:
  - query keys,
  - default limits,
  - API error mapping,
  - invalidation after mutation,
  - UI-ready state such as `isForbidden`, `emptyReason`, `canCreate`, and available actions.
- UI modules should focus on rendering.
- Keep `apiFetch` as the Bearer JWT HTTP adapter.

Tests:

- Run frontend lint and build.
- If a frontend test runner is introduced later, test view-model hook behavior around errors, empty states, and action invalidation.
- Manually smoke-test assigned, created, pool, done, and all views when environment is available.

Expected result:

- Contract behavior gains locality in frontend adapters.
- UI modules become less sensitive to endpoint or query-key changes.

## Phase 7: Cleanup, Docs, And Compatibility Exit

Goal: prevent old compatibility and architecture drift from reappearing.

Current friction:

- `assigned_to` compatibility may be necessary early in the roadmap.
- Docs already name `request_assignees` as source of truth, but code does not fully enforce that yet.

Design:

- Update docs after implementation phases:
  - `docs/architecture.md`
  - `docs/api-contract.md` if response or behavior semantics are clarified
  - `docs/database-schema.md`
  - `docs/permissions.md`
- Document:
  - `request_assignees` as source of truth,
  - `assigned_to` as compatibility or denormalized data if retained,
  - read models responsible for request list and dashboard semantics,
  - notification event publishing seam,
  - FileTree path invariants.
- Remove `assigned_to` fallback outside the assignment adapter.
- Only remove or deprecate `assigned_to` itself after data safety, schema migration, and tests prove it is safe.

Tests:

- Full backend unit test suite.
- Frontend lint and build.
- Smoke tests for request workflow, dashboard, notifications, and file operations when environment variables are available.
- Docs review for contradictions with implementation.

Expected result:

- The new seams are documented.
- Compatibility logic does not leak again.
- Future work has clearer architecture guidance.

## Overall Verification Strategy

Each phase should include:

- GitNexus impact analysis before editing any symbol.
- Focused tests for changed backend modules.
- Frontend lint/build for frontend changes.
- `gitnexus_detect_changes()` before any commit.
- Documentation updates when behavior or architecture changes.

## Implementation Order

Implement phases in order. Do not start Phase 3 before Phase 1 stabilizes, because request workflow deepening depends on a single assignment interpretation. Do not start Phase 4 before Phase 3 side-effect planning exists, unless Phase 4 is reduced to a narrow notification-module-only cleanup. Phase 5 and Phase 6 can be scheduled after Phase 2 if independent delivery is needed, but they should still retain their own baseline and verification steps.
