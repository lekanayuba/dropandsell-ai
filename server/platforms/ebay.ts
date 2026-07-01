import { db, pool, STORE_COLUMNS } from "../db";
import { orders, stores, appSettings, marketplaceListings, products } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

interface EbayAuthToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: EbayAuthToken | null = null;

const SCOPES = "https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const MARKETPLACE_MAP: Record<string, { marketplaceId: string; siteUrl: string; currency: string; siteId: string }> = {
  uk: { marketplaceId: "EBAY_GB", siteUrl: "ebay.co.uk", currency: "GBP", siteId: "3" },
  us: { marketplaceId: "EBAY_US", siteUrl: "ebay.com", currency: "USD", siteId: "0" },
  de: { marketplaceId: "EBAY_DE", siteUrl: "ebay.de", currency: "EUR", siteId: "77" },
  fr: { marketplaceId: "EBAY_FR", siteUrl: "ebay.fr", currency: "EUR", siteId: "71" },
  it: { marketplaceId: "EBAY_IT", siteUrl: "ebay.it", currency: "EUR", siteId: "101" },
  es: { marketplaceId: "EBAY_ES", siteUrl: "ebay.es", currency: "EUR", siteId: "186" },
  au: { marketplaceId: "EBAY_AU", siteUrl: "ebay.com.au", currency: "AUD", siteId: "15" },
};

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    const isRetryable = response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503;
    if (!isRetryable || attempt === retries) return response;
    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
    console.log(`[eBay] Retry ${attempt}/${retries} after ${delay}ms (status ${response.status})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("fetchWithRetry exhausted retries");
}

export async function getEbayAppSettings(): Promise<{ clientId: string; clientSecret: string; ruName: string }> {
  const keys = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_RU_NAME"];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return {
    clientId: settings["EBAY_CLIENT_ID"] || process.env.EBAY_CLIENT_ID || "",
    clientSecret: settings["EBAY_CLIENT_SECRET"] || process.env.EBAY_CLIENT_SECRET || "",
    ruName: settings["EBAY_RU_NAME"] || process.env.EBAY_RU_NAME || "",
  };
}

export async function getAccessToken(storeRefreshToken?: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = await getEbayAppSettings();
  const refreshToken = storeRefreshToken || process.env.EBAY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("eBay API not configured. Admin must set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET, and store must have a refresh token.");
  }

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };
  return tokenCache.accessToken;
}

async function getStoreRefreshToken(storeId: number): Promise<string | null> {
  const result = await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [storeId]);
  const store = result.rows;
  if (!store.length) return null;
  const creds = store[0].credentials as any;
  return creds?.ebayRefreshToken || null;
}

function getMarketplaceForCredentials(creds: any): { marketplaceId: string; siteUrl: string; currency: string; siteId: string } {
  const locale = (creds.marketplaceId || creds.marketplace || "uk").toLowerCase().replace("ebay_", "");
  return MARKETPLACE_MAP[locale] || MARKETPLACE_MAP.uk;
}

function buildHtmlDescription(title: string, description: string): string {
  const cleanDesc = description
    .replace(/<[^>]*>/g, "")
    .replace(/\n/g, "<br/>")
    .trim();
  return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px;">
    <h1 style="color: #333; font-size: 20px; margin-bottom: 16px;">${title}</h1>
    <div style="color: #555; line-height: 1.6; font-size: 14px;">${cleanDesc}</div>
  </div>`;
}

export async function createEbayListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images?: string[];
  conditionId?: string;
  categoryId?: string;
  storeCredentials: { apiKey?: string; token?: string; ebayRefreshToken?: string; marketplaceId?: string; marketplace?: string };
}): Promise<{ ebayItemId: string; listingUrl: string }> {
  const token = await getAccessToken(args.storeCredentials?.ebayRefreshToken);

  const market = getMarketplaceForCredentials(args.storeCredentials);

  const inventoryPayload: any = {
    sku: args.sku,
    product: {
      title: args.title.slice(0, 80),
      description: buildHtmlDescription(args.title, args.description),
      aspects: {},
      imageUrls: args.images?.slice(0, 24) || [],
      mpn: args.sku,
      brand: "Unbranded",
    },
    condition: args.conditionId ?? "NEW",
    conditionDescription: "New item",
    availability: {
      shipToLocationAvailability: { quantity: Math.min(args.quantity, 999) },
    },
    pricingSummary: {
      price: { value: String(args.price.toFixed(2)), currency: market.currency },
    },
  };

  const encSku = encodeURIComponent(args.sku);
  const invRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/inventory_item/${encSku}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(inventoryPayload),
  });
  if (!invRes.ok) {
    const errText = await invRes.text();
    if (invRes.status === 409 && errText.includes("DUPLICATE")) {
      // SKU already exists as inventory item, that's fine
      console.log(`[eBay] Inventory item ${args.sku} already exists, updating`);
    } else {
      throw new Error(`eBay inventory item creation failed: ${invRes.status} ${errText}`);
    }
  }

  const offerPayload: any = {
    sku: args.sku,
    marketplaceId: market.marketplaceId,
    format: "FIXED_PRICE",
    listingDescription: args.description.slice(0, 5000),
    availableQuantity: Math.min(args.quantity, 999),
    quantityLimitPerBuyer: 10,
    pricingSummary: {
      price: { value: String(args.price.toFixed(2)), currency: market.currency },
    },
    listingPolicies: {
      paymentPolicyId: "",
      returnPolicyId: "",
      shippingCostTariffs: [],
    },
    storeCategoryNames: [],
    listingDuration: "GTC",
  };

  // Only add tax for UK listings (eBay collects VAT for UK)
  if (market.marketplaceId === "EBAY_GB") {
    offerPayload.tax = { vatPercentage: 20 };
  }

  const offerRes = await fetchWithRetry("https://api.ebay.com/sell/inventory/v1/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(offerPayload),
  });

  let offerData: any;
  let offerId: string;

  if (offerRes.status === 409) {
    // Offer already exists — find the existing offer ID
    const searchRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${encSku}&marketplace_id=${market.marketplaceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existing = searchData.offers?.[0];
      if (existing) {
        offerId = existing.offerId;
        // Update the existing offer
        const updateRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(offerPayload),
        });
        if (!updateRes.ok) throw new Error(`eBay offer update failed: ${updateRes.status} ${await updateRes.text()}`);
      } else {
        throw new Error("eBay offer conflict but no existing offer found");
      }
    } else {
      throw new Error(`eBay offer creation failed (409): ${await offerRes.text()}`);
    }
  } else if (!offerRes.ok) {
    throw new Error(`eBay offer creation failed: ${offerRes.status} ${await offerRes.text()}`);
  } else {
    offerData = await offerRes.json();
    offerId = offerData.offerId;
  }

  // Publish the offer
  const pubRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });

  if (!pubRes.ok) {
    const pubErr = await pubRes.text();
    // If already published, try to get the existing listing ID
    if (pubRes.status === 409) {
      const searchRes = await fetch(
        `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const offerDetail = await searchRes.json();
        if (offerDetail.listingId) {
          return { ebayItemId: offerDetail.listingId, listingUrl: `https://www.${market.siteUrl}/itm/${offerDetail.listingId}` };
        }
      }
    }
    throw new Error(`Failed to publish offer to eBay: ${pubRes.status} ${pubErr}`);
  }

  const pubData = await pubRes.json();
  return {
    ebayItemId: pubData.listingId,
    listingUrl: `https://www.${market.siteUrl}/itm/${pubData.listingId}`,
  };
}

export async function endEbayListing(ebayItemId: string, storeId?: number): Promise<void> {
  try {
    const refreshToken = storeId ? await getStoreRefreshToken(storeId) : undefined;
    const token = await getAccessToken(refreshToken || undefined);

    // Look up the product SKU from the marketplace listing
    let sku: string | null = null;
    if (storeId) {
      const listings = await db.select({
        productId: marketplaceListings.productId,
      }).from(marketplaceListings)
        .where(and(eq(marketplaceListings.externalId, ebayItemId), eq(marketplaceListings.storeId, storeId)))
        .limit(1);

      if (listings.length) {
        const product = await db.select({ sku: products.sku })
          .from(products)
          .where(eq(products.id, listings[0].productId))
          .limit(1);
        if (product.length && product[0].sku) {
          sku = product[0].sku;
        }
      }
    }

    if (!sku) {
      console.warn(`[eBay] No SKU found for listing ${ebayItemId}, trying offer-based end`);
      // Try to find offers associated with this listing
      const offersRes = await fetch(
        `https://api.ebay.com/sell/inventory/v1/offer?listing_id=${ebayItemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        for (const offer of (offersData.offers || [])) {
          sku = offer.sku;
          break;
        }
      }
    }

    if (sku) {
      // Set inventory quantity to 0
      const getRes = await fetchWithRetry(
        `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } }
      );
      if (getRes.ok) {
        const item = await getRes.json();
        item.availability = item.availability || {};
        item.availability.shipToLocationAvailability = item.availability.shipToLocationAvailability || {};
        item.availability.shipToLocationAvailability.quantity = 0;

        await fetchWithRetry(
          `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(item),
          }
        );
        console.log(`[eBay] Listing ${ebayItemId} ended (quantity set to 0 via SKU: ${sku})`);
        return;
      }
    }

    console.warn(`[eBay] Could not end listing ${ebayItemId} — no SKU or product found`);
  } catch (err) {
    console.error(`[eBay] Error ending listing ${ebayItemId}:`, err);
  }
}

async function getEbayOrderLineItems(ebayOrderId: string, token: string): Promise<{ itemId: string; lineItemId: string }[]> {
  try {
    const res = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.lineItems || []).map((li: any) => ({ itemId: li.itemId, lineItemId: li.lineItemId }));
  } catch { return []; }
}

export async function updateEbayOrderStatus(
  ebayOrderId: string,
  status: "SHIPPED" | "DELIVERED",
  trackingNumber: string,
  carrier: string,
  storeId?: number,
): Promise<void> {
  try {
    const refreshToken = storeId ? await getStoreRefreshToken(storeId) : undefined;
    const token = await getAccessToken(refreshToken || undefined);

    const carrierMap: Record<string, string> = {
      "royal mail": "RoyalMail", "ups": "UPS", "dhl": "DHL", "fedex": "FedEx",
      "usps": "USPS", "dhl ecommerce": "DHLeCommerce", "hermes": "Hermes",
      "evri": "Evri", "dpd": "DPD", "parcelforce": "ParcelForce", "tnt": "TNT",
      "australia post": "AustraliaPost", "canada post": "CanadaPost",
    };
    const ebayCarrier = carrierMap[carrier.toLowerCase().trim()] || carrier;
    const lineItems = await getEbayOrderLineItems(ebayOrderId, token);
    if (lineItems.length === 0) {
      console.warn(`[eBay] No line items found for order ${ebayOrderId}, skipping fulfillment`);
      return;
    }

    const res = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Content-Language": "en-US" },
      body: JSON.stringify({
        lineItems: lineItems.map(li => ({ itemId: li.itemId, lineItemId: li.lineItemId })),
        shipped: { shipmentDate: new Date().toISOString(), trackingNumber, carrierUsed: ebayCarrier },
      }),
    });

    if (res.status === 409) {
      console.log(`[eBay] Fulfillment already exists for order ${ebayOrderId}, updating tracking`);
      // Update existing fulfillment with new tracking info
      const existingFulfillments = await fetch(
        `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (existingFulfillments.ok) {
        const fData = await existingFulfillments.json();
        for (const f of (fData.fulfillments || [])) {
          await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment/${f.fulfillmentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              lineItems: lineItems.map(li => ({ itemId: li.itemId, lineItemId: li.lineItemId })),
              shipped: { shipmentDate: new Date().toISOString(), trackingNumber, carrierUsed: ebayCarrier },
            }),
          }).catch(() => {});
        }
      }
    } else if (!res.ok) {
      console.error(`[eBay] Failed to update order ${ebayOrderId}: ${res.status} ${await res.text()}`);
    } else {
      console.log(`[eBay] Order ${ebayOrderId} updated to ${status} via ${ebayCarrier} (${trackingNumber})`);
    }
  } catch (err) {
    console.error(`[eBay] Error updating order ${ebayOrderId}:`, err);
  }
}
