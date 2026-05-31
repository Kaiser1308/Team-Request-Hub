# Architecture Optimization Baseline

Date: 2026-05-31

## Commands

| Area | Command | Result | Notes |
| --- | --- | --- | --- |
| Backend | `uv --cache-dir .uv-cache run python -m unittest discover tests` | PASS | 194 tests in 4.820s. Venv recreated due to broken symlink; dependencies reinstalled. |
| Frontend lint | `npm run lint` | PASS | ESLint: No issues found. |
| Frontend build | `npm run build` | SKIPPED | Not run: would require env values (SUPABASE_URL, etc.). |

## Protected Flows

- Request list: assigned, created, pool, done, all.
- Dashboard summary counts and recent lists.
- Request detail and request workflow actions.
- Notification record creation and external channel dispatch.
- File browse, upload, rename, move, delete, restore, purge.

## Test Gaps To Close

- Assignment source-of-truth cases across `assignee_ids`, `assignees`, and `assigned_to`.
- Multi-assignee dashboard counts.
- Pool view excludes any request with current assignees.
- Done view semantics for creator, assignee, and lead.
- FileTree descendant prefix edge case: `/foo` must not match `/foobar`.
