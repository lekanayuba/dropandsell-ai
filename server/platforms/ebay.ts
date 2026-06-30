import { db } from "../db";
import { orders } from "@shared/schema";
import { eq } from "drizzle-orm";

interface EbayAuthToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: EbayAuthToken | null = null;

const SCOPES = "https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);

    if (response.ok) return response;

    const isRetryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503;

    if (!isRetryable || attempt === retries) return response;

    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);

    console.log(`[eBay] Retry ${attempt}/${retries} after ${delay}ms (status ${response.status})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error("fetchWithRetry exhausted retries (should not reach here)");
}



async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;
  const ruName = process.env.EBAY_RU_NAME;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("eBay API not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REFRESH_TOKEN");
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

export async function createEbayListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  conditionId?: string;
  categoryId?: string;
  storeCredentials: { apiKey?: string; token?: string };
}): Promise<{ ebayItemId: string; listingUrl: string }> {
  const token = await getAccessToken();

  // Step 1: Create or update inventory item
  const inventoryPayload = {
    sku: args.sku,
    product: {
      title: args.title,
      description: args.description,
      aspects: {},
      imageUrls: [],
      mpn: args.sku,
      brand: "Unbranded",
    },
    condition: args.conditionId ?? "NEW",
    conditionDescription: "New item",
    availability: {
      shipToLocationAvailability: {
        quantity: args.quantity,
      },
    },
    pricingSummary: {
      price: {
        value: String(args.price),
        currency: "GBP",
      },
    },
  };

  const invRes = await fetchWithRetry(
    `https://api.ebay.com/sell/inventory/v1/inventory_item/${args.sku}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(inventoryPayload),
    },
  );

  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(`eBay inventory item creation failed: ${invRes.status} ${text}`);
  }

  // Step 2: Create an offer (listing) from the inventory item
  const offerPayload = {
    sku: args.sku,
    marketplaceId: "EBAY_GB",
    format: "FIXED_PRICE",
    listingDescription: args.description,
    availableQuantity: args.quantity,
    quantityLimitPerBuyer: 10,
    pricingSummary: {
      price: {
        value: String(args.price),
        currency: "GBP",
      },
    },
    listingPolicies: {
      paymentPolicyId: "",
      returnPolicyId: "",
      shippingCostTariffs: [],
    },
    storeCategoryNames: [],
    tax: {
      vatPercentage: 20,
    },
    listingDuration: "GTC",
  };

  const offerRes = await fetchWithRetry(
    "https://api.ebay.com/sell/inventory/v1/offer",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(offerPayload),
    },
  );

  if (!offerRes.ok) {
    const text = await offerRes.text();
    throw new Error(`eBay offer creation failed: ${offerRes.status} ${text}`);
  }

  const offerData = await offerRes.json();
  const offerId = offerData.offerId;

  // Step 3: Publish the offer to make it live on eBay
  const pubRes = await fetchWithRetry(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!pubRes.ok) {
    const text = await pubRes.text();
    console.error(`[eBay] Offer publish failed: ${pubRes.status} ${text}`);
    throw new Error("Failed to publish offer to eBay");
  }

  const pubData = await pubRes.json();
  const listingId = pubData.listingId;

  return {
    ebayItemId: listingId,
    listingUrl: `https://www.ebay.co.uk/itm/${listingId}`,
  };
}

export async function endEbayListing(ebayItemId: string): Promise<void> {
  try {
    const token = await getAccessToken();
    // Use eBay Inventory API to set quantity to 0
    const res = await fetchWithRetry(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      // If item not found in inventory API, try Trading API (legacy)
      await endEbayListingLegacy(ebayItemId, token);
      return;
    }

    const item = await res.json();
    if (item.availability?.shipToLocationAvailability?.quantity > 0) {
      // Set quantity to 0 to make it unavailable
      const updateRes = await fetchWithRetry(
        `https://api.ebay.com/sell/inventory/v1/inventory_item/${ebayItemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...item,
            availability: {
              ...item.availability,
              shipToLocationAvailability: {
                ...item.availability?.shipToLocationAvailability,
                quantity: 0,
              },
            },
          }),
        },
      );

      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error(`[eBay] Failed to update inventory ${ebayItemId}: ${updateRes.status} ${text}`);
      } else {
        console.log(`[eBay] Listing ${ebayItemId} quantity set to 0`);
      }
    }
  } catch (err) {
    console.error(`[eBay] Error ending listing ${ebayItemId}:`, err);
  }
}

async function endEbayListingLegacy(ebayItemId: string, token: string): Promise<void> {
  try {
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "EndItem",
        "X-EBAY-API-SITEID": "0",
        "Content-Type": "text/xml",
        Authorization: `Bearer ${token}`,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${ebayItemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[eBay] Legacy EndItem failed for ${ebayItemId}: ${res.status}`);
    } else {
      console.log(`[eBay] Listing ${ebayItemId} ended via Trading API`);
    }
  } catch (err) {
    console.error(`[eBay] Legacy EndItem error for ${ebayItemId}:`, err);
  }
}

async function getEbayOrderLineItems(ebayOrderId: string, token: string): Promise<{ itemId: string; lineItemId: string }[]> {
  try {
    const res = await fetch(`https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.lineItems || []).map((li: any) => ({
      itemId: li.itemId,
      lineItemId: li.lineItemId,
    }));
  } catch {
    return [];
  }
}

export async function updateEbayOrderStatus(
  ebayOrderId: string,
  status: "SHIPPED" | "DELIVERED",
  trackingNumber: string,
  carrier: string,
): Promise<void> {
  try {
    const token = await getAccessToken();

    const carrierMap: Record<string, string> = {
      "royal mail": "RoyalMail",
      "ups": "UPS",
      "dhl": "DHL",
      "fedex": "FedEx",
      "usps": "USPS",
      "dhl ecommerce": "DHLeCommerce",
      "hermes": "Hermes",
      "evri": "Evri",
      "dpd": "DPD",
      "parcelforce": "ParcelForce",
      "tnt": "TNT",
      "australia post": "AustraliaPost",
      "canada post": "CanadaPost",
    };

    const ebayCarrier = carrierMap[carrier.toLowerCase().trim()] || carrier;

    const lineItems = await getEbayOrderLineItems(ebayOrderId, token);
    if (lineItems.length === 0) {
      console.warn(`[eBay] No line items found for order ${ebayOrderId}, skipping fulfillment`);
      return;
    }

    const endpoint = `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Language": "en-US",
      },
      body: JSON.stringify({
        lineItems: lineItems.map(li => ({
          itemId: li.itemId,
          lineItemId: li.lineItemId,
        })),
        shipped: {
          shipmentDate: new Date().toISOString(),
          trackingNumber,
          carrierUsed: ebayCarrier,
        },
      }),
    });

    if (res.status === 409) {
      console.log(`[eBay] Fulfillment already exists for order ${ebayOrderId}`);
    } else if (!res.ok) {
      const text = await res.text();
      console.error(`[eBay] Failed to update order ${ebayOrderId}: ${res.status} ${text}`);
    } else {
      console.log(`[eBay] Order ${ebayOrderId} updated to ${status} via ${ebayCarrier} (${trackingNumber})`);
    }
  } catch (err) {
    console.error(`[eBay] Error updating order ${ebayOrderId}:`, err);
  }
}
