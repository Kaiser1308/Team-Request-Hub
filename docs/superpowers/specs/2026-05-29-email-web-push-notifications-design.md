# Email And Web Push Notifications Design

## Goal

Add individual notification delivery channels for Email and Web Push while keeping Telegram support. Each user can opt in or out per channel. Initial delivery scope matches the current Telegram behavior: send external notifications for `assigned` and `reassigned` request events only.

## Current Context

The backend owns notification side effects through `app.notification_module`. Request workflow services create user-facing `notifications` records, and routes schedule Telegram delivery in the background for assignment and reassignment events. The database already has `notification_deliveries` for per-channel tracking, but `notification_channel` currently only supports `telegram`.

Frontend Supabase usage remains limited to Auth/session handling. Provider credentials, SMTP settings, VAPID private keys, and delivery logic must stay backend-only.

## Recommended Approach

Use a channel-adapter design inside `notification_module`:

- Keep existing notification records as the source of user-facing in-app notifications.
- Store user channel preferences separately from notification records.
- Store Web Push subscriptions per browser/device.
- Dispatch Email, Web Push, and Telegram through backend adapters.
- Track every external send attempt in `notification_deliveries` using the channel name and delivery status.

This keeps the existing route/service boundary intact and makes later channels, such as Discord or Zalo, an adapter-level addition instead of a workflow rewrite.

## Database Changes

Extend `notification_channel` enum:

```txt
telegram | email | web_push
```

Add `notification_preferences`:

```txt
user_id uuid references users(id)
channel notification_channel
enabled boolean default true
created_at timestamptz
updated_at timestamptz
primary key (user_id, channel)
```

Add `web_push_subscriptions`:

```txt
id uuid primary key
user_id uuid references users(id)
endpoint text unique not null
p256dh text not null
auth text not null
user_agent text null
created_at timestamptz
last_used_at timestamptz null
revoked_at timestamptz null
```

RLS should be enabled on new public tables as defense in depth. The frontend should not query these tables directly; FastAPI continues using the service-role client and enforces current-user ownership on all preference and subscription endpoints.

## Backend API

Add notification preference endpoints:

```txt
GET   /notifications/preferences
PATCH /notifications/preferences
```

`GET /notifications/preferences` returns the current user's channel settings for `telegram`, `email`, and `web_push`.

`PATCH /notifications/preferences` accepts explicit channel booleans and updates only the authenticated user's rows. It must not allow updating another user's preferences.

Add Web Push endpoints:

```txt
GET    /notifications/web-push/vapid-public-key
POST   /notifications/web-push/subscriptions
DELETE /notifications/web-push/subscriptions/{subscription_id}
```

`GET /notifications/web-push/vapid-public-key` returns only the public VAPID key. The private key remains backend-only.

`POST /notifications/web-push/subscriptions` stores or refreshes the current user's browser subscription. It validates required subscription fields and binds the row to `current_user.id` server-side.

`DELETE /notifications/web-push/subscriptions/{subscription_id}` revokes only the current user's matching subscription.

## Backend Delivery Flow

For `assigned` and `reassigned` events:

1. Request workflow creates the existing in-app notification.
2. Route/background task calls a multi-channel dispatch function.
3. Dispatch loads current user's preferences.
4. Dispatch sends only enabled and configured channels.
5. Each send attempt creates a `notification_deliveries` row.
6. Successful sends are marked `sent`; failures are marked `failed` with a safe error message.

Email adapter:

- Uses SMTP settings from backend environment variables.
- Builds a concise bilingual-aware message from the request title, priority, status, and app request URL.
- Sends to `users.email`.
- Skips delivery if SMTP is not configured or email channel is disabled.

Web Push adapter:

- Uses VAPID keys from backend environment variables.
- Sends payload with notification title, body, request URL, and notification id.
- Sends to every active subscription for the user.
- Marks subscriptions revoked when the push service reports that the endpoint is gone or expired.
- Skips delivery if VAPID is not configured, no active subscriptions exist, or web push channel is disabled.

Telegram remains supported through the existing link/profile flow and should be included in the same preference model.

## Frontend UX

Add notification settings to the dashboard settings area or an existing notifications page:

- Telegram link/unlink remains visible as it is today.
- Email toggle enables or disables email delivery.
- Browser Push section has an explicit button: `Enable browser notifications`.
- The browser permission prompt appears only after the user clicks the enable button.
- If permission is denied, show a short explanation that the user must re-enable notifications in browser settings.
- If permission is granted, register the service worker, create a push subscription, and send it to the backend.

Add a service worker under the frontend public assets to receive push events and open the relevant request URL when the user clicks the notification.

## Configuration

Backend environment variables:

```txt
SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

Recommended free providers:

- Email production: Brevo free tier or Resend free tier when a domain is available.
- Email local testing: Gmail SMTP or a local SMTP capture tool.
- Web Push: no paid provider required; use VAPID keys generated for the app.

## Security And Privacy

- Never expose SMTP credentials or `VAPID_PRIVATE_KEY` to the frontend.
- Return only `VAPID_PUBLIC_KEY` to the browser.
- Bind every preference/subscription mutation to `current_user.id` on the backend.
- Do not accept `user_id` from the client for these endpoints.
- Store Web Push endpoint keys only in the backend database.
- Keep push payload minimal: title, short body, request id/url, and notification id. Do not include sensitive request descriptions.
- Fail closed if a provider is not configured.
- Log provider errors without exposing credentials or full payload secrets.

## Testing

Backend tests:

- Preference list/update returns only current user's settings.
- Web Push subscription create/revoke binds to current user.
- Multi-channel dispatch skips disabled channels.
- Email delivery creates and updates `notification_deliveries` status.
- Web Push delivery creates and updates delivery status and revokes expired subscriptions.
- Missing SMTP/VAPID config skips external sends without breaking request workflow.

Frontend checks:

- Settings page renders Telegram, Email, and Browser Push controls.
- Email toggle calls preference endpoint and invalidates notification settings query.
- Browser Push enable path registers the service worker and sends subscription payload.
- Denied permission state is handled without repeated prompts.

## Out Of Scope For Initial Implementation

- Discord, Slack, Teams, and Zalo channels.
- Per-notification-type preferences.
- Digest emails.
- Admin broadcast notifications.
- Sending Email/Web Push for every status change, done, or cancellation event.
