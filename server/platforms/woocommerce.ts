function getConfig() {
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET?.trim();
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL?.trim();
  if (!consumerKey || !consumerSecret || !storeUrl) {
    throw new Error("WooCommerce not configured. Set WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, WOOCOMMERCE_STORE_URL");
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  return { auth, storeUrl: storeUrl.replace(/\/+$/, "") };
}

export async function createWooCommerceListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images?: string[];
}): Promise<{ externalId: string; listingUrl: string }> {
  const { auth, storeUrl } = getConfig();

  const body: any = {
    name: args.title,
    description: args.description,
    sku: args.sku,
    regular_price: String(args.price),
    manage_stock: true,
    stock_quantity: args.quantity,
    status: "publish",
  };

  if (args.images?.length) {
    body.images = args.images.map((src) => ({ src }));
  }

  const res = await fetch(
    `${storeUrl}/wp-json/wc/v3/products`,
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
    throw new Error(`WooCommerce listing creation failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    externalId: String(data.id),
    listingUrl: data.permalink,
  };
}

export async function updateWooCommerceStock(args: {
  externalId: string;
  quantity: number;
}): Promise<void> {
  const { auth, storeUrl } = getConfig();

  const res = await fetch(
    `${storeUrl}/wp-json/wc/v3/products/${args.externalId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ stock_quantity: args.quantity }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`[WooCommerce] Stock update failed: ${res.status} ${text}`);
  }
}

export async function fetchWooCommerceStoreInventory(storeCredentials?: Record<string, any>): Promise<Map<string, number>> {
  const inventoryMap = new Map<string, number>();
  let consumerKey: string, consumerSecret: string, storeUrl: string;

  if (storeCredentials?.consumerKey) {
    consumerKey = storeCredentials.consumerKey;
    consumerSecret = storeCredentials.consumerSecret;
    storeUrl = storeCredentials.storeUrl;
  } else {
    consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY?.trim() || '';
    consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET?.trim() || '';
    storeUrl = process.env.WOOCOMMERCE_STORE_URL?.trim() || '';
  }

  if (!consumerKey || !consumerSecret || !storeUrl) {
    console.error('[WooCommerce] Not configured');
    return inventoryMap;
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  storeUrl = storeUrl.replace(/\/+$/, "");
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${storeUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`,
      {
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    if (!res.ok) {
      console.error(`[WooCommerce] Failed to fetch inventory: ${res.status}`);
      break;
    }

    const products = await res.json();
    if (!Array.isArray(products) || products.length === 0) break;

    for (const product of products) {
      if (product.sku) {
        inventoryMap.set(product.sku, product.stock_quantity ?? 0);
      }
    }

    hasMore = products.length >= 100;
    page++;
  }

  console.log(`[WooCommerce] Fetched ${inventoryMap.size} inventory items`);
  return inventoryMap;
}
