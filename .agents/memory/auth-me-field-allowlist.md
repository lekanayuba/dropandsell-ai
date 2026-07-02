---
name: /api/auth/me returns an explicit field allowlist
description: Why new user columns must be manually added to the auth "me" response
---

- The client's `useAuth()` reads the current user from `GET /api/auth/me`. That
  handler does NOT spread the user row — it returns an explicit hand-picked list
  of fields. Any new `users` column the frontend needs (e.g. a settings toggle
  like `autoRestock`) must be added to that response object too, or the UI reads
  `undefined` → renders as false/off after a reload even though the DB value is
  correct.
- **Why:** the allowlist intentionally hides sensitive columns (password,
  tokens, stripe id). Don't switch it to a blind spread. Add the specific new
  field.
- **How to apply:** when adding a user-level preference that the client shows,
  do all three: column in `shared/models/auth.ts`, idempotent migration in
  routes.ts, AND add the field to the `/api/auth/me` response.
