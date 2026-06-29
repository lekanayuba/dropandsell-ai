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
