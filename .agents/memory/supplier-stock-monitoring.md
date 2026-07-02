---
name: Supplier stock monitoring (SSRF-safe outbound fetch)
description: How auto out-of-stock detection fetches supplier listings safely, and why the guards exist
---

- Auto out-of-stock/restock detection works by fetching each imported product's
  live supplier listing (source URL from `products.attributes.sourceUrl`, or a
  reconstructed URL for id-only imports like Temu) and scanning the HTML for
  availability signals. Detection is best-effort text matching, not an API.

- **SSRF rule (do NOT weaken):** the source URL is user-controlled and fetched
  server-side on a timer, so every outbound fetch MUST go through an allowlist of
  known supplier domains, reject raw-IP hosts, DNS-resolve and reject
  private/loopback/link-local/CGNAT/metadata addresses, and follow redirects
  manually re-validating each hop. Unknown/non-allowlisted hosts return `unknown`
  and change nothing. **Why:** without this, a user could point a product at an
  internal URL (e.g. cloud metadata 169.254.169.254) and exfiltrate via the
  recurring background job.

- **False-positive rule:** only flag a listing unavailable when NO buy CTA
  ("add to cart"/"buy now"/etc.) is present in the HTML. A live purchasable page
  almost always renders a buy CTA; requiring its absence prevents "out of stock"
  text in related/variant blocks from wrongly zeroing good inventory. Ambiguous
  pages (JS-rendered / bot-blocked) return `unknown`.

- **Propagation:** the monitor only updates the `products` row (quantity +
  marketplaceStockStatus) and notifies. The existing `syncOutOfStockProducts`
  (OOS → marketplace listings/stores) and `backgroundSyncAllStores` (restock)
  reconcile the connected marketplaces. Keep the monitor running BEFORE those in
  the shared interval, guarded by a single-flight lock to avoid overlapping runs.
