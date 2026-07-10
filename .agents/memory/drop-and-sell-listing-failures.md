---
name: Drop-and-Sell listing-failure log
description: Why a dedicated failure-log table exists for Drop-and-Sell listers, what it must/mustn't store, and where every failure path has to be wired.
---

# Drop-and-Sell listing-failure log

When a Drop-and-Sell lister publishes a product into a **customer's** eBay store and the
publish fails, the flow rolls back — it deletes the product and its SKU mapping. So after a
failure there is **no natural record** left that an attempt happened, which store it targeted,
or why it failed. That is why a dedicated `drop_and_sell_listing_failures` snapshot table
exists: it is the only durable evidence of a failed attempt.

**Rule:** any new failure path in a lister publish flow must also write a failure row, or the
lister silently loses the notification.

**Where failures must be recorded:** there are TWO lister publish paths and both must be wired
at their *post-reservation* failure choke points:
- the web-dialog route (`POST /drop-and-sell/orders/:id/list-product`) — its `releaseSlotAndFail`
- the shared helper `performListProductIntoCustomerEbay` (used by extension callers) — its
  `rollbackEverythingAndFail` and the standalone SKU-mapping failure

**Why only post-reservation:** pre-reservation validation/token failures are intentionally NOT
logged (per architect) — they happen before any slot/product state changes and would be noise.

**Privacy rule:** the failure row stores only `storeName` = `"{ebayStore.name} (@{ebayUsername})"`
and a best-effort `customerName`. NEVER store customer email or eBay tokens. The recorder is
best-effort (try/catch, never throws) so logging can never break the publish flow.

**Security:** dismiss/resolve enforces IDOR by putting `freelancerId` in the WHERE clause; the
GET/POST endpoints resolve the caller's own approved freelancer profile.

**Deploy note:** this is a NEW table. The table is defined in `shared/schema.ts`, so Replit's
Publish flow will diff dev vs prod and create it in production automatically — do NOT hand-write
a prod migration/CREATE. (The dev copy still had to be created via SQL because Drizzle
`db:push`'s new-table prompt can't be piped — see the "Drizzle db:push interactive" memory.)
