# Backend API Performance Optimization

## Implemented

- Local Supabase JWT verification.
- Short current-user profile cache remains in place.
- Request responses include creator/assignee summaries.
- Dashboard uses `/dashboard/summary`.
- Optional backend request timing logs.

## Expected Impact

- Removes remote Supabase Auth call from every protected API request.
- Reduces dashboard API fan-out.
- Reduces frontend need for `/users/active` just to display request labels.

## Verification

- Backend tests: 256/256 pass after request workflow regression fixes
- Frontend lint: 0 errors, 0 warnings
- Frontend build: TypeScript/lint pass (pre-existing page module error unrelated)

## Remaining Follow-Up

- Cursor pagination if request volume grows.
- Exact count queries if dashboard needs full totals instead of bounded visible counts.
- Supabase local dev setup if hosted latency still affects development.
- Pool, done, and dashboard request reads now use SQL/RPC functions with `request_assignees` membership checks instead of relying on `assigned_to` filters or loading assignment rows in the API process.
- Move external notification delivery to a durable queue if Telegram, email, or web push volume grows beyond internal beta use.
