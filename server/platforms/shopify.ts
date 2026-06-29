const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

function getStoreDomain(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!domain) throw new Error("Shopify not configured. Set SHOPIFY_STORE_DOMAIN");
  return domain;
}

function getApiKey(): string {
  const key = process.env.SHOPIFY_API_KEY?.trim();
  if (!key) throw new Error("Shopify not configured. Set SHOPIFY_API_KEY");
  return key;
}

function getApiSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) throw new Error("Shopify not configured. Set SHOPIFY_API_SECRET");
  return secret;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === retries) return response;
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
    console.log(`[Shopify] Retry ${attempt}/${retries} after ${delay}ms (status ${response.status})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("fetchWithRetry exhausted retries");
}

export async function createShopifyListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images?: string[];
}): Promise<{ externalId: string; listingUrl: string }> {
  const domain = getStoreDomain();
  const apiKey = getApiKey();
  const apiSecret = getApiSecret();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const body: any = {
    product: {
      title: args.title,
      body_html: args.description,
      vendor: "DropandSell AI",
      product_type: "General",
      status: "active",
      variants: [{
        sku: args.sku,
        price: String(args.price),
        inventory_quantity: args.quantity,
        inventory_management: "shopify",
      }],
    },
  };

  if (args.images?.length) {
    body.product.images = args.images.map((src) => ({ src }));
  }

  const res = await fetchWithRetry(
    `https://${domain}/admin/api/2024-01/products.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify listing creation failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const productId = data.product.id;

  return {
    externalId: String(productId),
    listingUrl: `https://${domain}/products/${data.product.handle}`,
  };
}

export async function updateShopifyStock(args: {
  externalId: string;
  quantity: number;
}): Promise<void> {
  const domain = getStoreDomain();
  const auth = Buffer.from(`${getApiKey()}:${getApiSecret()}`).toString("base64");

  const res = await fetchWithRetry(
    `https://${domain}/admin/api/2024-01/products/${args.externalId}.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        product: {
          id: Number(args.externalId),
          variants: [{ inventory_quantity: args.quantity }],
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Shopify] Stock update failed: ${res.status} ${text}`);
  } else {
    console.log(`[Shopify] Stock updated for ${args.externalId} -> ${args.quantity}`);
  }
}

export async function updateShopifyPrice(args: {
  externalId: string;
  price: number;
}): Promise<void> {
  const domain = getStoreDomain();
  const auth = Buffer.from(`${getApiKey()}:${getApiSecret()}`).toString("base64");

  const res = await fetchWithRetry(
    `https://${domain}/admin/api/2024-01/variants/${args.externalId}.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        variant: { price: String(args.price) },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Shopify] Price update failed: ${res.status} ${text}`);
  }
}
