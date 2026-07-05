function getConfig() {
  const apiKey = process.env.JUMIA_API_KEY?.trim();
  const apiSecret = process.env.JUMIA_API_SECRET?.trim();
  const sellerId = process.env.JUMIA_SELLER_ID?.trim();
  if (!apiKey || !apiSecret || !sellerId) {
    throw new Error("Jumia not configured. Set JUMIA_API_KEY, JUMIA_API_SECRET, JUMIA_SELLER_ID");
  }
  return { apiKey, apiSecret, sellerId };
}

export async function createJumiaListing(args: {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  images?: string[];
}): Promise<{ externalId: string; listingUrl: string }> {
  const { apiKey, sellerId } = getConfig();

  // Jumia Open API uses XML/SOAP — product feed via Seller Center API
  // For the MVP, we register the offer via their RESTful Product API
  const body = {
    SellerId: sellerId,
    Action: "ProductCreate",
    Format: "JSON",
    Timestamp: new Date().toISOString(),
    Version: "1.0",
    ProductData: {
      SKU: args.sku,
      Name: args.title,
      Description: args.description,
      Price: args.price,
      Quantity: args.quantity,
      Images: args.images?.map((url, i) => ({ Url: url, IsMain: i === 0 })),
    },
  };

  const res = await fetch(
    "https://api.jumia.com/v1/products",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jumia listing creation failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    externalId: data.ProductId || args.sku,
    listingUrl: `https://www.jumia.com.ng/${args.sku}`,
  };
}

export async function fetchJumiaStoreInventory(storeCredentials?: Record<string, any>): Promise<Map<string, number>> {
  const inventoryMap = new Map<string, number>();
  let apiKey: string, sellerId: string;

  if (storeCredentials?.jumiaApiKey) {
    apiKey = storeCredentials.jumiaApiKey;
    sellerId = storeCredentials.jumiaSellerId;
  } else {
    apiKey = process.env.JUMIA_API_KEY?.trim() || '';
    sellerId = process.env.JUMIA_SELLER_ID?.trim() || '';
  }

  if (!apiKey || !sellerId) {
    console.error('[Jumia] Not configured');
    return inventoryMap;
  }

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `https://api.jumia.com/v1/products?sellerId=${sellerId}&page=${page}&pageSize=100`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      console.error(`[Jumia] Failed to fetch inventory: ${res.status}`);
      break;
    }

    const data = await res.json();
    const products = data.products || data.data || [];
    if (!Array.isArray(products) || products.length === 0) break;

    for (const product of products) {
      const sku = product.SKU || product.sku;
      if (!sku) continue;
      const qty = product.Quantity ?? product.quantity ?? product.stock ?? 0;
      inventoryMap.set(sku, Number(qty));
    }

    hasMore = products.length >= 100;
    page++;
  }

  console.log(`[Jumia] Fetched ${inventoryMap.size} inventory items`);
  return inventoryMap;
}
