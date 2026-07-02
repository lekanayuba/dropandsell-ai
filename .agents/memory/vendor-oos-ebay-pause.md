---
name: vendor out-of-stock → eBay pause
description: how confirmed vendor OOS ends eBay listings, and why it reuses the auto-pause lock
---

# Vendor out-of-stock must pause the eBay listing

When a vendor stock scrape SUCCEEDS and confirms out of stock
(`!stockResult.fetchFailed && stockResult.inStock === false`), the product's eBay
listings must be set to qty 0. This reuses `autoPauseListingsForFailedStock(product,
userId, attrs, trigger)` in `server/routes.ts` with `trigger: 'out-of-stock'`.

**Why reuse the auto-pause path (not a new one):** it already handles token refresh,
all-or-nothing safe locking, local `quantity=0`, listing `syncStatus`, and the user
email. The `autoPaused` lock is later lifted by `buildVendorStockUpdate` once the
vendor is confirmed back in stock, after which the restock sweep
(`ebayRestockScheduler`) refills the listing — so behaviour is fully reversible.

**Two triggers, different evidence strength:**
- `failed-stock` — repeated scrape FAILURES (`confidence === 'low'`). Weak evidence,
  so the "recent trusted Chrome-extension in-stock" bypass applies here.
- `out-of-stock` — a scrape POSITIVELY confirmed OOS. Strong evidence: the extension
  bypass must NOT apply, so it is gated to `trigger === 'failed-stock'` only.

**How to apply:** the trigger is wired into the 15-min background scan
(`runPriceMonitorCycle`) and the three on-demand routes (`check-vendor-stock`,
`check-all-vendor-stock`, `auto-sync-on-login`). A `pausingProductIds` in-flight Set
prevents overlapping scans from double-pausing/double-emailing.

**Known limitation (consistent with the restock sweep):** variation products are
skipped — child-variation SKUs aren't available at this layer.
