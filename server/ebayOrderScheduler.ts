import { storage } from "./storage.js";
import { reviseEbayQuantity } from "./marketplaces/ebay.js";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
// Default buffer quantity used by the auto-restock loop when the user hasn't
// customised their store rule. Must be > 1 — otherwise the listing drops to 0
// again on the very next sale and eBay hides it as "Out of stock". The value
// the user types into Dashboard → Store Rules overrides this on a per-user
// basis.
const DEFAULT_RESTOCK_BUFFER = 10;

async function getEffectiveRestockBuffer(userId: string): Promise<number> {
  try {
    const user = await storage.getUser(userId);
    if (user?.autoRestockEnabled && user.autoRestockBuffer && user.autoRestockBuffer > 0) {
      return user.autoRestockBuffer;
    }
  } catch {}
  return DEFAULT_RESTOCK_BUFFER;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

async function ensureValidEbayTokenForStore(store: any): Promise<string | null> {
  const creds = store.credentials as any;

  if (creds?.authToken && creds.tokenExpiry && Date.now() < creds.tokenExpiry - 60000) {
    return creds.authToken;
  }

  if (!creds?.refreshToken) return null;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) return null;

  const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');
  try {
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      }).toString(),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || tokenData.error) {
      return null;
    }

    const newCredentials = {
      ...creds,
      authToken: tokenData.access_token,
      tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
    };
    await storage.updateStore(store.id, store.userId, { credentials: newCredentials });
    // Mutate the in-memory store so subsequent calls in this sync (e.g.
    // reviseEbayQuantity for auto-restock) use the freshly refreshed token.
    store.credentials = newCredentials;
    return tokenData.access_token;
  } catch {
    return null;
  }
}

async function fetchEbayOrdersForSync(accessToken: string, daysBack: number = 7): Promise<any[]> {
  const allOrders: any[] = [];
  const filterDate = new Date();
  filterDate.setDate(filterDate.getDate() - daysBack);
  const isoDate = filterDate.toISOString();

  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.ebay.com/sell/fulfillment/v1/order?filter=creationdate:[${isoDate}..]&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) break;

    const data = await response.json() as any;
    const ebayOrders = data.orders || [];
    allOrders.push(...ebayOrders);

    if (ebayOrders.length < limit || (data.total && offset + limit >= data.total)) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allOrders;
}

async function syncOrdersForStore(store: any): Promise<{ newOrders: number; updatedOrders: number; revenue: number }> {
  const userId = store.userId;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalRevenue = 0;

  const accessToken = await ensureValidEbayTokenForStore(store);
  if (!accessToken) return { newOrders: 0, updatedOrders: 0, revenue: 0 };

  const ebayOrders = await fetchEbayOrdersForSync(accessToken);

  // Collect quantity updates that need to be pushed to eBay so we can flush
  // them in batched ReviseInventoryStatus calls (max 4 per call) ONCE per
  // store, after every order has been processed. Doing this per-order would
  // burn through the daily call quota for high-volume sellers.
  const pendingEbayUpdates = new Map<string, { itemId: string; sku: string; quantity: number }>();

  for (const ebayOrder of ebayOrders) {
    const orderId = ebayOrder.orderId;
    const orderStatus = ebayOrder.orderFulfillmentStatus || 'NOT_STARTED';
    const pricingSummary = ebayOrder.pricingSummary || {};
    const totalStr = pricingSummary.total?.value || '0';
    const totalAmount = parseFloat(totalStr);
    const buyer = ebayOrder.buyer || {};
    const buyerName = buyer.username || '';
    const fulfillmentInstructions = ebayOrder.fulfillmentStartInstructions || [];
    const shippingStep = fulfillmentInstructions[0]?.shippingStep || {};
    const shipTo = shippingStep.shipTo || {};
    const contactAddress = shipTo.contactAddress || {};

    const shippingAddress = {
      name: shipTo.fullName || buyerName,
      addressLine1: contactAddress.addressLine1 || '',
      addressLine2: contactAddress.addressLine2 || '',
      city: contactAddress.city || '',
      stateOrProvince: contactAddress.stateOrProvince || '',
      postalCode: contactAddress.postalCode || '',
      countryCode: contactAddress.countryCode || '',
    };

    let appStatus = 'pending';
    const paymentStatus = ebayOrder.orderPaymentStatus || '';
    if (paymentStatus === 'PAID' || paymentStatus === 'FULLY_REFUNDED') appStatus = 'processing';
    if (orderStatus === 'FULFILLED') appStatus = 'shipped';
    if (ebayOrder.cancelStatus?.cancelState === 'CANCELED') appStatus = 'cancelled';

    const isDelivered = (ebayOrder.lineItems || []).every((li: any) => !!(li.deliveredDate || li.properties?.deliveredDate));
    const hasDeliveryConfirmation = orderStatus === 'FULFILLED' && (
      isDelivered ||
      (ebayOrder.fulfillmentHrefs && ebayOrder.fulfillmentHrefs.length > 0 &&
       (ebayOrder.lineItems || []).some((li: any) => li.properties?.buyerProtection?.status === 'ACTIVE'))
    );
    if (hasDeliveryConfirmation && appStatus === 'shipped') appStatus = 'delivered';

    let fulfillmentStatus = 'unfulfilled';
    if (orderStatus === 'FULFILLED') fulfillmentStatus = 'fulfilled';
    else if (orderStatus === 'IN_PROGRESS') fulfillmentStatus = 'in_progress';

    const ebayLineItems = (ebayOrder.lineItems || []).map((li: any) => ({
      sku: li.sku || '',
      title: li.title || '',
      quantity: li.quantity || 1,
      lineItemId: li.lineItemId || '',
      price: li.total?.value || li.lineItemCost?.value || '0',
      variationAspects: li.variationAspects || [],
      imageUrl: li.image?.imageUrl || '',
    }));

    const existingOrder = await storage.getOrderByExternalId(orderId, userId);
    if (existingOrder) {
      const statusChanged = existingOrder.status !== appStatus || existingOrder.fulfillmentStatus !== fulfillmentStatus;
      const existingLineItems = (existingOrder as any).lineItems || [];
      const hasNewVariationData = ebayLineItems.some((li: any) => li.variationAspects?.length > 0) && !existingLineItems.some((li: any) => li.variationAspects?.length > 0);
      const needsLineItemUpdate = (ebayLineItems.length > 0 && existingLineItems.length === 0) || hasNewVariationData;
      if (statusChanged || needsLineItemUpdate) {
        const wasPendingNowPaid = existingOrder.status === 'pending' && (appStatus === 'processing' || appStatus === 'shipped');
        await storage.updateOrder(existingOrder.id, userId, {
          status: appStatus,
          fulfillmentStatus,
          totalAmount: String(totalAmount),
          lineItems: ebayLineItems.length > 0 ? ebayLineItems : undefined,
        });
        totalUpdated++;
        if (wasPendingNowPaid && paymentStatus === 'PAID' && totalAmount > 0) {
          totalRevenue += totalAmount;
        }
      }

      for (const li of ebayLineItems) {
        if (li.sku) {
          try {
            const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
            if (!existingMapping) {
              const product = await storage.getProductBySku(userId, li.sku);
              if (product) {
                const attrs = (product.attributes || {}) as Record<string, any>;
                await storage.createSkuMapping({
                  userId,
                  ebaySku: li.sku,
                  vendorId: product.vendorId,
                  vendorSku: product.sku,
                  vendorProductUrl: attrs.sourceUrl || '',
                  vendorName: product.vendorName || 'Unknown',
                  costPrice: String(product.costPrice),
                  ebayTitle: li.title || undefined,
                  ebayPrice: li.price || undefined,
                  isActive: true,
                });
              } else {
                await storage.createSkuMapping({
                  userId,
                  ebaySku: li.sku,
                  vendorSku: '',
                  vendorName: '',
                  ebayTitle: li.title || undefined,
                  ebayPrice: li.price || undefined,
                  isActive: true,
                });
              }
            }
          } catch {}
        }
      }
    } else {
      await storage.createOrder({
        userId,
        storeId: store.id,
        externalOrderId: orderId,
        customerName: shippingAddress.name || buyerName,
        customerEmail: buyer.buyerRegistrationAddress?.email || '',
        shippingAddress,
        lineItems: ebayLineItems.length > 0 ? ebayLineItems : undefined,
        totalAmount: String(totalAmount),
        status: appStatus,
        fulfillmentStatus,
      });
      totalNew++;

      if (paymentStatus === 'PAID' && totalAmount > 0) {
        totalRevenue += totalAmount;
      }

      for (const li of ebayLineItems) {
        if (li.sku) {
          try {
            const product = await storage.getProductBySku(userId, li.sku);
            if (product) {
              const soldQty = li.quantity || 1;
              const currentQty = product.quantity || 0;
              const newQty = Math.max(0, currentQty - soldQty);
              const restockBuffer = await getEffectiveRestockBuffer(userId);
              const finalQty = newQty === 0 ? restockBuffer : newQty;
              await storage.updateProduct(product.id, userId, { quantity: finalQty });
              if (newQty === 0) {
                console.log(`[Auto-Restock] "${product.title}" (SKU ${li.sku}) sold out → restocked to ${restockBuffer}`);
              }

              // Whenever the listing went to zero on eBay (i.e. the sale that
              // just synced was the one that emptied it), eBay has hidden
              // the listing. We MUST push the restocked quantity back so the
              // listing becomes visible again. Also fire when the item is
              // running low (newQty < 3) as a safety buffer. The push itself
              // is deferred and batched per-store at the end of this sync.
              if (newQty === 0 || newQty < 3) {
                try {
                  const listings = await storage.getMarketplaceListings(store.id);
                  const match = listings.find((l: any) => l.productId === product.id && l.externalId);
                  if (match?.externalId) {
                    // Map dedupes by (itemId, sku) so two orders for the
                    // same listing in this sync window only produce one
                    // ReviseInventoryStatus entry — the latest finalQty wins.
                    const key = `${match.externalId}::${li.sku}`;
                    pendingEbayUpdates.set(key, { itemId: match.externalId, sku: li.sku, quantity: finalQty });
                  } else {
                    console.warn(`[Auto-Restock] No marketplace_listing row found for product ${product.id} on store "${store.name}" — local qty restocked to ${finalQty} but cannot push to eBay.`);
                  }
                } catch (lookupErr: any) {
                  console.error(`[Auto-Restock] Listing lookup failed for product ${product.id}:`, lookupErr?.message || lookupErr);
                }
              }
              const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
              if (!existingMapping) {
                const attrs = (product.attributes || {}) as Record<string, any>;
                await storage.createSkuMapping({
                  userId,
                  ebaySku: li.sku,
                  vendorId: product.vendorId,
                  vendorSku: product.sku,
                  vendorProductUrl: attrs.sourceUrl || '',
                  vendorName: product.vendorName || 'Unknown',
                  costPrice: String(product.costPrice),
                  ebayTitle: li.title || undefined,
                  ebayPrice: li.price || undefined,
                  isActive: true,
                });
              }
            } else {
              const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
              if (!existingMapping) {
                await storage.createSkuMapping({
                  userId,
                  ebaySku: li.sku,
                  vendorSku: '',
                  vendorName: '',
                  ebayTitle: li.title || undefined,
                  ebayPrice: li.price || undefined,
                  isActive: true,
                });
              }
            }
          } catch {}
        }
      }
    }
  }

  // Flush all per-store auto-restock quantity updates back to eBay in one
  // batched ReviseInventoryStatus call (chunked 4 per request inside the
  // helper). Mark each listing's syncStatus so the safety-net sweep can
  // retry the failures regardless of whether the local DB qty is high.
  if (pendingEbayUpdates.size > 0) {
    const updates = Array.from(pendingEbayUpdates.values());
    try {
      const result = await reviseEbayQuantity(store.credentials, updates);
      const failedItemIds = new Set(result.failed.map((f) => f.itemId));
      const successCount = updates.length - failedItemIds.size;
      if (successCount > 0) {
        console.log(`[Auto-Restock] Pushed quantity to eBay for ${successCount} listing(s) on store "${store.name}"`);
      }
      // Mark listings as synced/errored so the sweep job can retry the
      // failed ones even though local DB quantity is now high.
      try {
        const allListings = await storage.getMarketplaceListings(store.id);
        for (const u of updates) {
          const listing = allListings.find((l: any) => l.externalId === u.itemId);
          if (!listing) continue;
          if (failedItemIds.has(u.itemId)) {
            await storage.updateMarketplaceListing(listing.id, { syncStatus: 'error', lastSync: new Date() });
          } else {
            await storage.updateMarketplaceListing(listing.id, { syncStatus: 'synced', lastSync: new Date() });
          }
        }
      } catch {}
      for (const f of result.failed) {
        console.error(`[Auto-Restock] eBay rejected restock for item ${f.itemId}: ${f.error}`);
      }
    } catch (revErr: any) {
      console.error(`[Auto-Restock] Failed to push restock to eBay for store "${store.name}":`, revErr?.message || revErr);
      // Mark every pending listing as errored so the sweep retries them.
      try {
        const allListings = await storage.getMarketplaceListings(store.id);
        for (const u of updates) {
          const listing = allListings.find((l: any) => l.externalId === u.itemId);
          if (listing) {
            await storage.updateMarketplaceListing(listing.id, { syncStatus: 'error', lastSync: new Date() });
          }
        }
      } catch {}
    }
  }

  if (totalRevenue > 0) {
    try {
      let userWallet = await storage.getWallet(userId);
      if (!userWallet) {
        userWallet = await storage.createWallet(userId);
      }
      await storage.updateWalletBalance(userWallet.id, totalRevenue);
      await storage.createTransaction({
        walletId: userWallet.id,
        type: 'deposit',
        amount: String(totalRevenue.toFixed(2)),
        description: `eBay sales revenue (${totalNew} new order${totalNew !== 1 ? 's' : ''})`,
        status: 'completed',
      });
    } catch {}
  }

  return { newOrders: totalNew, updatedOrders: totalUpdated, revenue: totalRevenue };
}

async function runBackgroundSync() {
  if (isSyncing) {
    console.log('[eBay BG Sync] Skipped — previous sync still in progress');
    return;
  }
  isSyncing = true;
  try {
    const ebayStores = await storage.getAllActiveStoresByPlatform('ebay');
    if (ebayStores.length === 0) return;

    const userStoreMap = new Map<string, typeof ebayStores>();
    for (const store of ebayStores) {
      const userId = store.userId;
      if (!userStoreMap.has(userId)) userStoreMap.set(userId, []);
      userStoreMap.get(userId)!.push(store);
    }

    let totalNewAll = 0;
    let totalUpdatedAll = 0;

    for (const [userId, userStores] of userStoreMap) {
      for (const store of userStores) {
        try {
          const result = await syncOrdersForStore(store);
          totalNewAll += result.newOrders;
          totalUpdatedAll += result.updatedOrders;
        } catch (err: any) {
          console.error(`[eBay BG Sync] Error for store ${store.id} (user ${userId}):`, err.message);
        }
      }
    }

    if (totalNewAll > 0 || totalUpdatedAll > 0) {
      console.log(`[eBay BG Sync] Complete: ${totalNewAll} new, ${totalUpdatedAll} updated across ${userStoreMap.size} user(s)`);
    }
  } catch (err: any) {
    console.error('[eBay BG Sync] Fatal error:', err.message);
  } finally {
    isSyncing = false;
  }
}

export function startEbayOrderScheduler() {
  if (syncTimer) return;
  console.log(`[eBay BG Sync] Started — syncing every ${SYNC_INTERVAL_MS / 60000} minutes`);

  setTimeout(() => {
    runBackgroundSync();
  }, 30000);

  syncTimer = setInterval(runBackgroundSync, SYNC_INTERVAL_MS);
}
