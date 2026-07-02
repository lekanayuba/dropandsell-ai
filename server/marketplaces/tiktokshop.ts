import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult, TikTokShopCredentials } from "./types";
import crypto from "crypto";

const TIKTOK_API_BASE = "https://open-api.tiktokglobalshop.com";

function generateSign(path: string, params: Record<string, string>, appSecret: string, body?: string): string {
  const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && k !== 'access_token').sort();
  let baseString = appSecret + path;
  for (const key of sortedKeys) {
    baseString += key + params[key];
  }
  if (body) {
    baseString += body;
  }
  baseString += appSecret;
  return crypto.createHmac("sha256", appSecret).update(baseString).digest("hex");
}

function buildUrl(path: string, creds: TikTokShopCredentials, extraParams: Record<string, string> = {}, body?: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    app_key: creds.appKey,
    timestamp,
    ...extraParams,
  };

  if (creds.shopCipher) {
    params.shop_cipher = creds.shopCipher;
  }

  const sign = generateSign(path, params, creds.appSecret, body);
  params.sign = sign;
  params.access_token = creds.accessToken;

  const queryString = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${TIKTOK_API_BASE}${path}?${queryString}`;
}

export const tiktokShopProvider: MarketplaceProvider = {
  validateCredentials(credentials: any): { valid: boolean; error?: string } {
    const creds = credentials as TikTokShopCredentials;
    if (!creds?.appKey) return { valid: false, error: "App Key is required" };
    if (!creds?.appSecret) return { valid: false, error: "App Secret is required" };
    if (!creds?.accessToken) return { valid: false, error: "Access Token is required" };
    return { valid: true };
  },

  async testConnection(credentials: any): Promise<TestConnectionResult & { shopData?: { shopId: string; shopName: string; shopCipher: string } }> {
    const creds = credentials as TikTokShopCredentials;

    try {
      const path = "/authorization/202309/shops";
      const url = buildUrl(path, creds);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-tts-access-token": creds.accessToken },
      });

      const data = await response.json();

      if (data.code === 0 && data.data?.shops?.length > 0) {
        const shop = data.data.shops[0];
        return {
          success: true,
          status: "connected",
          message: `Connected to TikTok Shop: ${shop.name || shop.id}`,
          shopData: {
            shopId: shop.id,
            shopName: shop.name || '',
            shopCipher: shop.cipher || '',
          },
        };
      }

      if (response.status === 401 || data.code === 105001 || data.code === 105002) {
        return { success: false, status: "invalid", message: "Invalid or expired access token. Please re-authorize." };
      }

      return {
        success: false,
        status: "invalid",
        message: data.message || `TikTok Shop connection failed (code: ${data.code})`,
      };
    } catch (err: any) {
      return { success: false, status: "invalid", message: `Failed to connect to TikTok Shop: ${err.message}` };
    }
  },

  async publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult> {
    const creds = credentials as TikTokShopCredentials;

    try {
      const categoryId = product.categoryId || await findCategory(creds, product.title);
      if (!categoryId) {
        return { success: false, externalId: "", error: "Could not determine TikTok Shop category. Please set a category ID in the product." };
      }

      const imageIds: string[] = [];
      for (const imgUrl of product.images.filter(img => img && img.startsWith("http")).slice(0, 9)) {
        const imgId = await uploadImageByUrl(creds, imgUrl);
        if (imgId) imageIds.push(imgId);
      }

      if (imageIds.length === 0) {
        return { success: false, externalId: "", error: "Failed to upload any product images to TikTok Shop." };
      }

      const descriptionHtml = product.description
        ? product.description.replace(/<[^>]*>/g, '').substring(0, 10000)
        : product.title;

      const productBody: any = {
        title: product.title.substring(0, 255),
        description: descriptionHtml,
        category_id: categoryId,
        main_images: imageIds.map(id => ({ uri: id })),
        skus: [
          {
            outer_sku_id: product.sku || `SKU-${Date.now()}`,
            original_price: product.price,
            stock_infos: [
              {
                available_stock: product.quantity || 1,
              },
            ],
          },
        ],
        is_cod_allowed: false,
        package_dimensions: {
          height: "10",
          length: "20",
          width: "15",
          unit: "CENTIMETER",
        },
        package_weight: {
          value: "500",
          unit: "GRAM",
        },
      };

      const bodyStr = JSON.stringify(productBody);
      const path = "/product/202309/products";
      const url = buildUrl(path, creds, {}, bodyStr);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tts-access-token": creds.accessToken,
        },
        body: bodyStr,
      });

      const data = await response.json();

      if (data.code === 0 && data.data?.product_id) {
        const productId = data.data.product_id;
        return {
          success: true,
          externalId: productId,
          listingUrl: `https://seller.tiktokglobalshop.com/product/detail?id=${productId}`,
        };
      }

      const errorMsg = data.message || JSON.stringify(data.data?.errors || data);
      return { success: false, externalId: "", error: `TikTok Shop API error: ${errorMsg}` };
    } catch (err: any) {
      return { success: false, externalId: "", error: `Failed to publish to TikTok Shop: ${err.message}` };
    }
  },
};

async function uploadImageByUrl(creds: TikTokShopCredentials, imageUrl: string): Promise<string | null> {
  try {
    const body = JSON.stringify({ url: imageUrl });
    const path = "/product/202309/images/upload";
    const url = buildUrl(path, creds, {}, body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
      body,
    });

    const data = await response.json();
    if (data.code === 0 && data.data?.uri) {
      return data.data.uri;
    }
    console.error(`[TikTok] Image upload failed for ${imageUrl}:`, data.message || data);
    return null;
  } catch (err: any) {
    console.error(`[TikTok] Image upload error:`, err.message);
    return null;
  }
}

export async function fetchTikTokOrders(creds: TikTokShopCredentials, createdAfterTimestamp?: number): Promise<any[]> {
  const allOrders: any[] = [];
  let nextPageToken: string | undefined;
  let page = 0;
  const maxPages = 5;

  try {
    do {
      const bodyObj: any = {
        page_size: 50,
        sort_field: "CREATE_TIME",
        sort_order: "DESC",
      };

      if (createdAfterTimestamp) {
        bodyObj.create_time_ge = createdAfterTimestamp;
      }

      if (nextPageToken) {
        bodyObj.next_page_token = nextPageToken;
      }

      const body = JSON.stringify(bodyObj);
      const path = "/order/202309/orders/search";
      const url = buildUrl(path, creds, {}, body);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tts-access-token": creds.accessToken,
        },
        body,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[TikTok] Order search HTTP ${response.status}:`, errText);
        throw new Error(`TikTok API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 0) {
        console.error(`[TikTok] Order search failed:`, data.message || data);
        throw new Error(data.message || `TikTok API error code ${data.code}`);
      }

      const orders = data.data?.orders || [];
      allOrders.push(...orders);

      nextPageToken = data.data?.next_page_token;
      page++;
    } while (nextPageToken && page < maxPages);

    return allOrders;
  } catch (err: any) {
    console.error(`[TikTok] fetchTikTokOrders error:`, err.message);
    throw err;
  }
}

export async function fetchTikTokOrderDetail(creds: TikTokShopCredentials, orderIds: string[]): Promise<any[]> {
  try {
    const body = JSON.stringify({ order_ids: orderIds });
    const path = "/order/202309/orders";
    const url = buildUrl(path, creds, {}, body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
      body,
    });

    if (!response.ok) {
      console.error(`[TikTok] Order detail HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.code !== 0) {
      console.error(`[TikTok] Order detail fetch failed:`, data.message || data);
      return [];
    }

    return data.data?.orders || [];
  } catch (err: any) {
    console.error(`[TikTok] fetchTikTokOrderDetail error:`, err.message);
    return [];
  }
}

export async function getShippingProviders(creds: TikTokShopCredentials, orderId: string): Promise<any[]> {
  try {
    const path = `/fulfillment/202309/orders/${orderId}/shipping_services`;
    const url = buildUrl(path, creds);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
    });

    if (!response.ok) {
      console.error(`[TikTok] Shipping providers HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.code === 0) {
      return data.data?.shipping_services || [];
    }
    console.error(`[TikTok] Shipping providers API error:`, data.message || data);
    return [];
  } catch (err: any) {
    console.error(`[TikTok] getShippingProviders error:`, err.message);
    return [];
  }
}

export async function uploadTikTokTracking(
  creds: TikTokShopCredentials,
  orderId: string,
  trackingNumber: string,
  shippingProviderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const bodyObj = {
      tracking_number: trackingNumber,
      shipping_provider_id: shippingProviderId,
    };
    const body = JSON.stringify(bodyObj);
    const path = `/fulfillment/202309/orders/${orderId}/packages`;
    const url = buildUrl(path, creds, {}, body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `TikTok API HTTP ${response.status}: ${errText}` };
    }

    const data = await response.json();

    if (data.code === 0) {
      return { success: true };
    }

    return { success: false, error: data.message || `TikTok API error code: ${data.code}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchTikTokProductImages(creds: TikTokShopCredentials, productId: string): Promise<string[]> {
  try {
    const path = `/product/202309/products/${productId}`;
    const url = buildUrl(path, creds);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
    });

    if (!response.ok) {
      console.error(`[TikTok] Product detail HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.code !== 0 || !data.data) {
      console.error(`[TikTok] Product detail error:`, data.message || data);
      return [];
    }

    const images: string[] = [];
    const product = data.data;

    if (product.main_images && Array.isArray(product.main_images)) {
      for (const img of product.main_images) {
        const imgUrl = img.url || img.thumb_url || img.urls?.[0];
        if (imgUrl) images.push(imgUrl);
      }
    }

    if (product.images && Array.isArray(product.images)) {
      for (const img of product.images) {
        const imgUrl = typeof img === 'string' ? img : (img.url || img.thumb_url || img.urls?.[0]);
        if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
      }
    }

    return images.slice(0, 9);
  } catch (err: any) {
    console.error(`[TikTok] fetchTikTokProductImages error:`, err.message);
    return [];
  }
}

async function findCategory(creds: TikTokShopCredentials, title: string): Promise<string | null> {
  try {
    const body = JSON.stringify({ keyword: title.substring(0, 50) });
    const path = "/product/202309/categories/search";
    const url = buildUrl(path, creds, {}, body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": creds.accessToken,
      },
      body,
    });

    const data = await response.json();
    if (data.code === 0 && data.data?.categories?.length > 0) {
      const leafCategory = data.data.categories.find((c: any) => c.is_leaf) || data.data.categories[0];
      return leafCategory.id;
    }
    return null;
  } catch (err: any) {
    console.error(`[TikTok] Category search error:`, err.message);
    return null;
  }
}
