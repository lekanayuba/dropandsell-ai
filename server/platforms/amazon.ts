import crypto from "crypto";

interface AmazonAuthToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: AmazonAuthToken | null = null;

const MARKETPLACE_IDS: Record<string, string> = {
  "UK": "A1F83G8C2ARO7P",
  "US": "ATVPDKIKX0DER",
  "DE": "A1PA6795UKMFR9",
  "FR": "A13V1IB3VIYZZH",
  "IT": "APJ6JRA9NG5V4",
  "ES": "A1RKKUPIHCS9HS",
  "CA": "A2EUQ1WTGCTBG2",
  "JP": "A1VC38T7YXB528",
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === retries) return response;
    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
    console.log(`[Amazon] Retry ${attempt}/${retries} after ${delay}ms (status ${response.status})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("fetchWithRetry exhausted retries");
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Amazon SP-API not configured. Set AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, AMAZON_REFRESH_TOKEN");
  }

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amazon auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 120_000,
  };
  return tokenCache.accessToken;
}

function getSpApiEndpoint(marketplaceId: string): string {
  // EU endpoint for European marketplaces, NA for North America, FE for Far East
  const euMarketplaces = ["A1F83G8C2ARO7P", "A1PA6795UKMFR9", "A13V1IB3VIYZZH", "APJ6JRA9NG5V4", "A1RKKUPIHCS9HS"];
  if (euMarketplaces.includes(marketplaceId)) {
    return "https://sellingpartnerapi-eu.amazon.com";
  }
  if (marketplaceId === "A1VC38T7YXB528") {
    return "https://sellingpartnerapi-fe.amazon.com";
  }
  return "https://sellingpartnerapi-na.amazon.com";
}

export async function createAmazonListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images?: string[];
  marketplaceId?: string;
  productType?: string;
}): Promise<{ externalId: string; listingUrl: string }> {
  const token = await getAccessToken();
  const marketplaceId = args.marketplaceId || "A1F83G8C2ARO7P";
  const endpoint = getSpApiEndpoint(marketplaceId);

  // Step 1: Search for existing product by SKU (Listings API)
  const sellerId = process.env.AMAZON_SELLER_ID;
  if (!sellerId) {
    throw new Error("Amazon seller ID not configured. Set AMAZON_SELLER_ID");
  }

  // Step 2: Create or update listing item via Listings API (2021-08-01)
  const patchBody = {
    productType: args.productType || "PRODUCT",
    requirements: "LISTING",
    attributes: {
      "merchant_seller_id": [{ value: sellerId }],
      "merchant_shipping_group_name": [{ value: "Default" }],
      "condition_type": [{ value: "New" }],
      "purchasable_offer": [{
        currency: "GBP",
        our_price: [{ schedule: [{ value_with_tax: { value: String(args.price) } }] }],
        fulfillments: [{
          fulfillment_channel_code: "DEFAULT",
          item_condition: { value: "New" },
          seller_sku: { value: args.sku },
        }],
      }],
      "item_name": [{ value: args.title }],
      "product_description": [{ value: args.description }],
      "quantity": [{ value: String(args.quantity) }],
      "main_product_image_locator": args.images?.length ? [{ media_location: { value: args.images[0] } }] : [],
    },
  };

  const listRes = await fetchWithRetry(
    `${endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(args.sku)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
        "x-amz-marketplace-id": marketplaceId,
      },
      body: JSON.stringify(patchBody),
    },
  );

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Amazon listing creation failed: ${listRes.status} ${text}`);
  }

  const listData = await listRes.json();
  const externalId = listData.sku || args.sku;

  return {
    externalId,
    listingUrl: `https://www.amazon.co.uk/dp/${externalId}`,
  };
}

export async function updateAmazonStock(args: {
  sku: string;
  quantity: number;
  marketplaceId?: string;
}): Promise<void> {
  const token = await getAccessToken();
  const marketplaceId = args.marketplaceId || "A1F83G8C2ARO7P";
  const endpoint = getSpApiEndpoint(marketplaceId);
  const sellerId = process.env.AMAZON_SELLER_ID;
  if (!sellerId) throw new Error("AMAZON_SELLER_ID not configured");

  const res = await fetchWithRetry(
    `${endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(args.sku)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
        "x-amz-marketplace-id": marketplaceId,
      },
      body: JSON.stringify({
        productType: "PRODUCT",
        patches: [{
          op: "replace",
          path: "/attributes/quantity",
          value: [{ value: String(args.quantity) }],
        }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Amazon] Stock update failed for ${args.sku}: ${res.status} ${text}`);
  } else {
    console.log(`[Amazon] Stock updated for ${args.sku} -> ${args.quantity}`);
  }
}

export async function updateAmazonPrice(args: {
  sku: string;
  price: number;
  marketplaceId?: string;
}): Promise<void> {
  const token = await getAccessToken();
  const marketplaceId = args.marketplaceId || "A1F83G8C2ARO7P";
  const endpoint = getSpApiEndpoint(marketplaceId);
  const sellerId = process.env.AMAZON_SELLER_ID;
  if (!sellerId) throw new Error("AMAZON_SELLER_ID not configured");

  const res = await fetchWithRetry(
    `${endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(args.sku)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
        "x-amz-marketplace-id": marketplaceId,
      },
      body: JSON.stringify({
        productType: "PRODUCT",
        patches: [{
          op: "replace",
          path: "/attributes/purchasable_offer",
          value: [{
            currency: "GBP",
            our_price: [{ schedule: [{ value_with_tax: { value: String(args.price) } }] }],
          }],
        }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Amazon] Price update failed for ${args.sku}: ${res.status} ${text}`);
  } else {
    console.log(`[Amazon] Price updated for ${args.sku} -> ${args.price}`);
  }
}
