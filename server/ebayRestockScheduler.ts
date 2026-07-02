import { storage } from "./storage.js";
import { reviseEbayQuantity } from "./marketplaces/ebay.js";

// Runs every 30 minutes. The order-sync auto-restock handles the common case
// (sale comes in → DB decremented → restock fired immediately), but a few
// edge cases can leave a listing stuck at 0 on eBay:
//
//   1. The user's eBay GetUser/GetOrders quota was exhausted when the order
//      came in, so we never saw the sale and never fired the restock.
//   2. The order sync's ReviseInventoryStatus call failed once (network /
//      transient eBay error) and was never retried — these listings are
//      tagged syncStatus='error' by the order sync so we pick them up here
//      regardless of local quantity.
//   3. The user manually edited a product's quantity in the dashboard but
//      the change wasn't pushed to eBay.
//
// This safety-net job sweeps every active eBay store, finds any listing
// whose linked product has quantity below LOW_THRESHOLD OR whose
// syncStatus is 'error', restocks the local DB to RESTOCK_BUFFER, then
// pushes that quantity to eBay via the lightweight ReviseInventoryStatus
// call (batched 4-per-request, plenty of daily quota).

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_RESTOCK_BUFFER = 10;
// Platform-default trigger: top up any listing whose linked product has
// fewer than this many units. When the user has explicitly enabled their
// own auto-restock rule we use THEIR buffer as the threshold instead —
// otherwise saving "Restock to 50" would do nothing until qty dropped
// below 3, which is what users were complaining about.
const DEFAULT_LOW_THRESHOLD = 3;
const MAX_LISTINGS_PER_STORE_PER_RUN = 200;

// Resolves the buffer the sweep should restock to AND the "low" threshold
// at which the sweep fires for a given user. When the user has enabled
// the "Default auto-restock" rule on Dashboard → Store Rules we use their
// value for both (top up everything below their target); otherwise we fall
// back to the conservative platform defaults so an unset rule never
// over-writes healthy listings.
async function getEffectiveRestockSettings(userId: string): Promise<{ buffer: number; lowThreshold: number; ruleEnabled: boolean }> {
  try {
    const user = await storage.getUser(userId);
    if (user?.autoRestockEnabled && user.autoRestockBuffer && user.autoRestockBuffer > 0) {
      return { buffer: user.autoRestockBuffer, lowThreshold: user.autoRestockBuffer, ruleEnabled: true };
    }
  } catch {}
  return { buffer: DEFAULT_RESTOCK_BUFFER, lowThreshold: DEFAULT_LOW_THRESHOLD, ruleEnabled: false };
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let isSweeping = false;
// Per-store in-flight guard shared by the scheduled sweep and the
// immediate save-time apply, so a user hammering "Save & Sync" doesn't
// race the half-hour cron and double-push to eBay.
const inflightStoreIds = new Set<number>();

function isVariationProduct(product: any): boolean {
  // Variation listings need eBay's child-variation SKU on
  // ReviseInventoryStatus — and we only know the parent SKU here. Skip
  // those in the sweep so we don't blast eBay with rejected updates;
  // the order-sync path uses the per-line-item SKU and handles them fine.
  const attrs = (product?.attributes || {}) as Record<string, any>;
  if (Array.isArray(attrs.variations) && attrs.variations.length > 0) return true;
  if (Array.isArray((product as any)?.variations) && (product as any).variations.length > 0) return true;
  return false;
}

async function sweepStore(store: any): Promise<{ scanned: number; restocked: number; failed: number; skippedVariation: number }> {
  const userId = store.userId;
  let scanned = 0;
  let restocked = 0;
  let failed = 0;
  let skippedVariation = 0;

  // Skip if another sweep (scheduled OR save-time apply) is already
  // working this store — we'd just re-push the same quantities.
  if (inflightStoreIds.has(store.id)) {
    return { scanned: 0, restocked: 0, failed: 0, skippedVariation: 0 };
  }
  inflightStoreIds.add(store.id);
  try {

  let listings: any[] = [];
  try {
    listings = await storage.getMarketplaceListings(store.id);
  } catch (err: any) {
    console.error(`[Auto-Restock Sweep] Could not load listings for store "${store.name}":`, err?.message || err);
    return { scanned: 0, restocked: 0, failed: 0, skippedVariation: 0 };
  }

  // Only consider listings that point at one of our products and look active.
  // Errored listings (failed previous push) are kept in the candidate list
  // even when local DB qty is healthy so we can retry them.
  const candidateListings = listings.filter((l: any) => {
    if (!l.externalId || !l.productId) return false;
    const status = (l.status || '').toLowerCase();
    if (status === 'ended' || status === 'cancelled' || status === 'deleted') return false;
    return true;
  }).slice(0, MAX_LISTINGS_PER_STORE_PER_RUN);

  // Map dedupes by (itemId, sku) so the eBay batch never carries duplicates.
  const pending = new Map<string, { itemId: string; sku: string; quantity: number; listingId: number }>();

  // Resolve the user's rule once per store sweep — buffer + threshold
  // both come from the user's "Default auto-restock quantity" setting
  // when the rule is on, so saving a high value (e.g. 50) actually
  // sweeps every listing currently below 50, not just below 3.
  const { buffer: restockBuffer, lowThreshold } = await getEffectiveRestockSettings(userId);

  for (const listing of candidateListings) {
    scanned++;
    try {
      const product = await storage.getProduct(listing.productId, userId);
      if (!product) continue;

      const qty = product.quantity ?? 0;
      const isErrored = (listing.syncStatus || '').toLowerCase() === 'error';
      // Skip if both: stock is at or above the user's target AND last push didn't error.
      if (qty >= lowThreshold && !isErrored) continue;

      // Variation listings can't be safely updated by the sweep because we
      // don't have the child variation SKU here. Skip — they're handled by
      // the order-sync path which uses the per-line-item SKU.
      if (isVariationProduct(product)) {
        skippedVariation++;
        continue;
      }

      // SAFETY GUARD: products that the vendor-stock safety net auto-paused
      // (because we couldn't verify supplier stock 3+ times in a row) MUST
      // NOT be auto-restocked here — that would silently undo the pause and
      // re-expose the listing to buyers while the supplier issue is still
      // unresolved. The autoPaused flag is cleared in
      // `buildVendorStockUpdate` when a supplier scrape next succeeds, after
      // which the user is expected to manually re-list.
      const productAttrs = (product.attributes || {}) as Record<string, any>;
      if (productAttrs?.vendorStock?.autoPaused === true) {
        continue;
      }

      // Restock local DB (only if below the user's target) and queue the
      // eBay push. `restockBuffer`/`lowThreshold` were resolved once at
      // the top of this store sweep from the user's saved rule.
      if (qty < lowThreshold) {
        await storage.updateProduct(product.id, userId, { quantity: restockBuffer });
      }
      const targetQty = Math.max(qty, restockBuffer);
      const key = `${listing.externalId}::${product.sku}`;
      pending.set(key, { itemId: listing.externalId, sku: product.sku, quantity: targetQty, listingId: listing.id });
      restocked++;
    } catch (err: any) {
      console.error(`[Auto-Restock Sweep] Error checking listing ${listing.id}:`, err?.message || err);
    }
  }

  if (pending.size === 0) return { scanned, restocked, failed, skippedVariation };

  // We don't include `sku` in the push payload because the sweep only ever
  // queues non-variation listings — eBay accepts ItemID-only inventory
  // updates for those. Including a SKU eBay doesn't recognise causes
  // "Item specified does not exist" rejections.
  const pushPayload = Array.from(pending.values()).map((p) => ({ itemId: p.itemId, quantity: p.quantity }));

  try {
    const result = await reviseEbayQuantity(store.credentials, pushPayload);
    const failedItemIds = new Set(result.failed.map((f) => f.itemId));
    failed = failedItemIds.size;

    // Mark each listing's syncStatus so the next sweep knows whether to
    // retry. Successful pushes flip back to 'synced' so they leave the
    // forced-retry pool.
    for (const p of pending.values()) {
      try {
        const newStatus = failedItemIds.has(p.itemId) ? 'error' : 'synced';
        await storage.updateMarketplaceListing(p.listingId, { syncStatus: newStatus, lastSync: new Date() } as any);
      } catch {}
    }

    if (failed > 0) {
      const grouped: Record<string, number> = {};
      for (const f of result.failed) grouped[f.error] = (grouped[f.error] || 0) + 1;
      for (const [msg, count] of Object.entries(grouped)) {
        console.error(`[Auto-Restock Sweep] eBay rejected ${count} item(s) on store "${store.name}": ${msg}`);
      }
    }
  } catch (err: any) {
    failed = pending.size;
    console.error(`[Auto-Restock Sweep] Push to eBay failed for store "${store.name}":`, err?.message || err);
    // Tag everything as errored so the next sweep retries.
    for (const p of pending.values()) {
      try {
        await storage.updateMarketplaceListing(p.listingId, { syncStatus: 'error', lastSync: new Date() } as any);
      } catch {}
    }
  }

  return { scanned, restocked, failed, skippedVariation };
  } finally {
    inflightStoreIds.delete(store.id);
  }
}

async function runRestockSweep() {
  if (isSweeping) {
    console.log('[Auto-Restock Sweep] Skipped — previous sweep still running');
    return;
  }
  isSweeping = true;
  const startedAt = Date.now();
  try {
    const ebayStores = await storage.getAllActiveStoresByPlatform('ebay');
    if (ebayStores.length === 0) {
      isSweeping = false;
      return;
    }

    let totalScanned = 0;
    let totalRestocked = 0;
    let totalFailed = 0;
    let totalSkippedVariation = 0;

    for (const store of ebayStores) {
      try {
        const result = await sweepStore(store);
        totalScanned += result.scanned;
        totalRestocked += result.restocked;
        totalFailed += result.failed;
        totalSkippedVariation += result.skippedVariation;
      } catch (err: any) {
        console.error(`[Auto-Restock Sweep] Unhandled error for store "${store.name}":`, err?.message || err);
      }
    }

    if (totalRestocked > 0 || totalFailed > 0) {
      const took = ((Date.now() - startedAt) / 1000).toFixed(1);
      const skippedNote = totalSkippedVariation > 0 ? `, skipped ${totalSkippedVariation} variation` : '';
      console.log(`[Auto-Restock Sweep] Done in ${took}s — scanned ${totalScanned}, restocked ${totalRestocked}, failed ${totalFailed}${skippedNote} across ${ebayStores.length} store(s)`);
    }
  } catch (err: any) {
    console.error('[Auto-Restock Sweep] Fatal error:', err?.message || err);
  } finally {
    isSweeping = false;
  }
}

export function startEbayRestockScheduler() {
  if (sweepTimer) return;
  console.log(`[Auto-Restock Sweep] Started — sweeping every ${SWEEP_INTERVAL_MS / 60000} minutes (default threshold < ${DEFAULT_LOW_THRESHOLD}, default restock buffer ${DEFAULT_RESTOCK_BUFFER}; user rules override both)`);

  // First run after 2 minutes — gives the order-sync scheduler time to do
  // its 30-second initial pass first so we don't double up.
  setTimeout(() => {
    runRestockSweep();
  }, 2 * 60 * 1000);

  sweepTimer = setInterval(runRestockSweep, SWEEP_INTERVAL_MS);
}

// One-shot sweep limited to a single user's active eBay stores. Called
// from PATCH /api/user/store-rules right after the user saves so a freshly
// raised buffer is pushed to eBay immediately instead of waiting up to 30
// minutes for the next scheduled sweep. Safe to call concurrently with
// the scheduler — both use the same store-level guards.
export async function applyRestockRuleForUser(userId: string): Promise<{ stores: number; scanned: number; restocked: number; failed: number }> {
  const stores = (await storage.getStores(userId)).filter(s => s.platform === 'ebay' && s.isActive);
  let totalScanned = 0;
  let totalRestocked = 0;
  let totalFailed = 0;
  for (const store of stores) {
    try {
      const result = await sweepStore(store);
      totalScanned += result.scanned;
      totalRestocked += result.restocked;
      totalFailed += result.failed;
    } catch (err: any) {
      console.error(`[Auto-Restock] Immediate apply failed for store "${store.name}":`, err?.message || err);
    }
  }
  if (stores.length > 0) {
    console.log(`[Auto-Restock] Immediate apply for user ${userId} — ${stores.length} store(s), scanned ${totalScanned}, restocked ${totalRestocked}, failed ${totalFailed}`);
  }
  return { stores: stores.length, scanned: totalScanned, restocked: totalRestocked, failed: totalFailed };
}
