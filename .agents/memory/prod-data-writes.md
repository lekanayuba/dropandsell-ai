---
name: Writing to production data
description: How to make bulk changes to the production database when the agent's SQL access is read-only.
---

# Writing to production data

The agent's `executeSql` against production is **read-only** (it hits a read replica). You cannot directly mutate prod data from the agent.

**Pattern to write prod data:** build an admin-guarded POST endpoint in the app itself, plus a button in the admin dashboard. The endpoint runs with the app's own DB connection, which has write access. The user must **Publish** (deploy) and click the button on the **live** site — only the deployed app writes to prod. Clicking it in dev only affects the dev DB.

**Why:** prod schema/data are managed through Publish; the agent has no direct prod write channel.

**How to apply — safety checklist for such endpoints:**
- Guard behind the existing admin middleware (session.isAdmin + DB role check).
- Snapshot the columns you mutate into a backup table first, for reversibility.
- Make updates idempotent (e.g. `COALESCE(col, now())`, `WHERE col IS DISTINCT FROM ...`).
- Wrap all statements in a single pooled transaction (BEGIN/COMMIT, rollback on error, release client in finally).
- Add CSRF defense: session cookie must set `sameSite: "lax"`, and destructive admin POSTs should reject cross-origin requests (compare `Origin` host to `Host`). Session cookie config lives in `server/replit_integrations/auth/replitAuth.ts`.
- Validate the exact SQL first against the dev DB inside a `BEGIN; ... ROLLBACK;` so nothing persists.
