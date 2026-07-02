---
name: Drizzle nullable column comparisons
description: JS ?? / || on a Drizzle column does not become SQL COALESCE — nullable columns need isNull()/or()
---

# Nullable columns in Drizzle where clauses

Writing `lte(table.col ?? fallback, x)` does NOT produce SQL `COALESCE(col, fallback)`.
The `??` is plain JS evaluated before the query is built; since a column object is
truthy, it just returns the column and the fallback is silently ignored. Rows where
`col IS NULL` then fail the comparison and are skipped.

**Why:** the tracking monitor's pending-order filter used
`lte(orders.trackingUpdatedAt ?? new Date(0), oneHourAgo)`, so brand-new orders
(never checked, `tracking_updated_at IS NULL`) were never polled — status never
updated and customers never emailed.

**How to apply:** for a nullable column, branch explicitly:
`or(isNull(table.col), lte(table.col, x))`. Never rely on `??`/`||` against a column
to handle NULLs in a Drizzle where clause.
