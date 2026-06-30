import { db } from "../db";
import { orders, stores, appSettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface EbayAuthToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: EbayAuthToken | null = null;

const SCOPES = "https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory";
const APP_KEYS = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_RU_NAME"] as const;
type AppKey = typeof APP_KEYS[number];

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

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

/** Read eBay app credentials from DB (app_settings table), fall back to env vars */
export async function getEbayAppSettings(): Promise<{ clientId: string; clientSecret: string; ruName: string }> {
  const rows = await db.select().from(appSettings).where(
    and(eq(appSettings.key, "EBAY_CLIENT_ID"), eq(appSettings.key, "EBAY_CLIENT_SECRET"), eq(appSettings.key, "EBAY_RU_NAME"))
  );
  // Since AND across different rows won't work, fetch individually
  const all = await db.select().from(appSettings);
  const getVal = (key: string) => all.find(r => r.key === key)?.value || process.env[key] || "";
  return {
    clientId: getVal("EBAY_CLIENT_ID"),
    clientSecret: getVal("EBAY_CLIENT_SECRET"),
    ruName: getVal("EBAY_RU_NAME"),
  };
}

/** Get an access token using either a store-specific refresh token or the global one */
async function getAccessToken(storeRefreshToken?: string): Promise<string> {
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

/** Look up a store's eBay refresh token from its credentials */
async function getStoreRefreshToken(storeId: number): Promise<string | null> {
  const store = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store.length) return null;
  const creds = store[0].credentials as any;
  return creds?.ebayRefreshToken || null;
}

export async function createEbayListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  conditionId?: string;
  categoryId?: string;
  storeCredentials: { apiKey?: string; token?: string; ebayRefreshToken?: string };
}): Promise<{ ebayItemId: string; listingUrl: string }> {
  const token = await getAccessToken(args.storeCredentials?.ebayRefreshToken);

  const inventoryPayload = {
    sku: args.sku,
    product: { title: args.title, description: args.description, aspects: {}, imageUrls: [], mpn: args.sku, brand: "Unbranded" },
    condition: args.conditionId ?? "NEW",
    conditionDescription: "New item",
    availability: { shipToLocationAvailability: { quantity: args.quantity } },
    pricingSummary: { price: { value: String(args.price), currency: "GBP" } },
  };

  const invRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/inventory_item/${args.sku}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(inventoryPayload),
  });
  if (!invRes.ok) throw new Error(`eBay inventory item creation failed: ${invRes.status} ${await invRes.text()}`);

  const offerPayload = {
    sku: args.sku,
    marketplaceId: "EBAY_GB",
    format: "FIXED_PRICE",
    listingDescription: args.description,
    availableQuantity: args.quantity,
    quantityLimitPerBuyer: 10,
    pricingSummary: { price: { value: String(args.price), currency: "GBP" } },
    listingPolicies: { paymentPolicyId: "", returnPolicyId: "", shippingCostTariffs: [] },
    storeCategoryNames: [],
    tax: { vatPercentage: 20 },
    listingDuration: "GTC",
  };

  const offerRes = await fetchWithRetry("https://api.ebay.com/sell/inventory/v1/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(offerPayload),
  });
  if (!offerRes.ok) throw new Error(`eBay offer creation failed: ${offerRes.status} ${await offerRes.text()}`);

  const offerData = await offerRes.json();
  const pubRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!pubRes.ok) throw new Error("Failed to publish offer to eBay");

  const pubData = await pubRes.json();
  return { ebayItemId: pubData.listingId, listingUrl: `https://www.ebay.co.uk/itm/${pubData.listingId}` };
}

export async function endEbayListing(ebayItemId: string, storeId?: number): Promise<void> {
  try {
    const refreshToken = storeId ? await getStoreRefreshToken(storeId) : undefined;
    const token = await getAccessToken(refreshToken || undefined);

    const res = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { await endEbayListingLegacy(ebayItemId, token); return; }

    const item = await res.json();
    if (item.availability?.shipToLocationAvailability?.quantity > 0) {
      const updateRes = await fetchWithRetry(`https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...item, availability: { ...item.availability, shipToLocationAvailability: { ...item.availability?.shipToLocationAvailability, quantity: 0 } } }),
      });
      if (!updateRes.ok) console.error(`[eBay] Failed to update inventory ${ebayItemId}: ${updateRes.status} ${await updateRes.text()}`);
      else console.log(`[eBay] Listing ${ebayItemId} quantity set to 0`);
    }
  } catch (err) {
    console.error(`[eBay] Error ending listing ${ebayItemId}:`, err);
  }
}

async function endEbayListingLegacy(ebayItemId: string, token: string): Promise<void> {
  try {
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: { "X-EBAY-API-COMPATIBILITY-LEVEL": "967", "X-EBAY-API-CALL-NAME": "EndItem", "X-EBAY-API-SITEID": "0", "Content-Type": "text/xml", Authorization: `Bearer ${token}` },
      body: `<?xml version="1.0" encoding="utf-8"?><EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><ItemID>${ebayItemId}</ItemID><EndingReason>NotAvailable</EndingReason></EndItemRequest>`,
    });
    if (!res.ok) console.error(`[eBay] Legacy EndItem failed for ${ebayItemId}: ${res.status}`);
    else console.log(`[eBay] Listing ${ebayItemId} ended via Trading API`);
  } catch (err) { console.error(`[eBay] Legacy EndItem error for ${ebayItemId}:`, err); }
}

async function getEbayOrderLineItems(ebayOrderId: string, token: string): Promise<{ itemId: string; lineItemId: string }[]> {
  try {
    const res = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
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
    if (lineItems.length === 0) { console.warn(`[eBay] No line items found for order ${ebayOrderId}, skipping fulfillment`); return; }

    const res = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Content-Language": "en-US" },
      body: JSON.stringify({
        lineItems: lineItems.map(li => ({ itemId: li.itemId, lineItemId: li.lineItemId })),
        shipped: { shipmentDate: new Date().toISOString(), trackingNumber, carrierUsed: ebayCarrier },
      }),
    });

    if (res.status === 409) console.log(`[eBay] Fulfillment already exists for order ${ebayOrderId}`);
    else if (!res.ok) console.error(`[eBay] Failed to update order ${ebayOrderId}: ${res.status} ${await res.text()}`);
    else console.log(`[eBay] Order ${ebayOrderId} updated to ${status} via ${ebayCarrier} (${trackingNumber})`);
  } catch (err) { console.error(`[eBay] Error updating order ${ebayOrderId}:`, err); }
}
