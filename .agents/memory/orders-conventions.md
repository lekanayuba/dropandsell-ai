---
name: Order/tenant + admin conventions
description: Non-obvious ownership and admin-check conventions when adding/restoring order routes in this app.
---

# Ownership enforcement is at the ROUTE layer, not storage
- Historically, storage mutation methods here were NOT tenant-scoped at the DB layer. Ownership was enforced in routes by pre-checking `getOrder(id, userId)` (returns undefined if not owned) before mutating.
- `storage.updateOrder(id, updates, userId?)` now takes an OPTIONAL `userId` that adds `AND user_id = ?` to the WHERE when passed. It stays optional for backward-compat with ~11 existing call sites (sync jobs, auto-fulfillment) that already operate on user-scoped rows.
- **How to apply:** any NEW user-facing order-mutation route must both pre-check `getOrder(id, userId)` AND pass `userId` to `updateOrder(...)`. Don't rely on storage alone.
- **Why:** defense-in-depth against cross-tenant mutation; a route that forgets the pre-check would otherwise be able to mutate any tenant's order by id.

# Admin check convention
- Admin = `user.role === 'admin'` OR the founder email (`dropandsellauth@gmail.com`). There is NO `isAdmin === 'true'` flag — code using that silently never grants admin.
- **How to apply:** gate admin-only routes with `user?.role === 'admin' || user?.email === '<founder email>'`.
