# UI Framework Audit

## Reference Rules

- Source of truth: docs/frontend-ui-framework.md
- Visual reference only: ui-frameware/
- No static HTML, Tailwind CDN, Material Symbols, hard-coded demo data, or decorative ambient blobs copied into apps/web.

## Screen Findings

| Screen | Reference | Current route | Required alignment work |
| --- | --- | --- | --- |
| Login | ui-frameware/login_team_request_hub/screen.png | apps/web/src/app/(auth)/login/page.tsx | Replace placeholder-style layout with compact product login, Google OAuth button, loading and error states. |
| Dashboard | ui-frameware/dashboard_team_request_hub/screen.png | apps/web/src/app/(dashboard)/dashboard/page.tsx | Align summary cards, recent requests, recent activity, and lead links with internal-tool density. |
| Assigned | ui-frameware/assigned_to_me_team_request_hub/screen.png | apps/web/src/app/(dashboard)/assigned/page.tsx | Align filters, request cards, next action, and empty state. |
| Created | ui-frameware/created_by_me_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/page.tsx | Align creator-focused list, status/assignee metadata, cancel action, and create link. |
| Pool | ui-frameware/pool_team_request_hub/screen.png | apps/web/src/app/(dashboard)/pool/page.tsx | Align priority filter, self-assign action, and BE/lead-only view. |
| Create | ui-frameware/create_new_request_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/new/page.tsx | Align form width, labels, validation text, priority selector, submit/back controls. |
| Detail | ui-frameware/request_detail_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx | Align title/status block, action bar, reply dialogs, timeline, assignment history. |
| Done | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/done/page.tsx | Use completed request cards with done reply preview and detail link. |
| All | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/all/page.tsx | Lead-only compact all-requests list with filters. |
| Admin Users | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/admin/users/page.tsx | Lead-only role management table with update state and forbidden state. |

## Inventory Notes

- Route inventory includes all planned phase routes plus `apps/web/src/app/(auth)/pending-approval/page.tsx` and app root/layout files.
- Component inventory includes app shell, auth controls, request components, notifications, admin role table, and `apps/web/src/components/ui/button.tsx`.
- The `rtk` command wrapper requested by the plan is not available in this environment, so inventory was captured with equivalent file globbing.
