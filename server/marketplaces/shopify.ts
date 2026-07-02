import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult, ShopifyCredentials } from "./types";

export const shopifyProvider: MarketplaceProvider = {
  validateCredentials(credentials: any): { valid: boolean; error?: string } {
    const creds = credentials as ShopifyCredentials;
    if (!creds?.shopDomain) return { valid: false, error: "Shop domain is required (e.g. mystore.myshopify.com)" };
    if (!creds?.accessToken) return { valid: false, error: "Access token is required" };
    if (!creds.shopDomain.includes('.myshopify.com') && !creds.shopDomain.includes('.')) {
      return { valid: false, error: "Shop domain should be like mystore.myshopify.com" };
    }
    return { valid: true };
  },

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    const creds = credentials as ShopifyCredentials;
    const domain = creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    try {
      const response = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': creds.accessToken },
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, status: 'connected', message: `Connected to ${data.shop?.name || domain} successfully` };
      }

      if (response.status === 401) {
        return { success: false, status: 'invalid', message: 'Invalid access token. Check your Shopify credentials.' };
      }
      return { success: false, status: 'invalid', message: `Shopify connection failed (${response.status})` };
    } catch (err: any) {
      return { success: false, status: 'invalid', message: `Failed to connect to Shopify: ${err.message}` };
    }
  },

  async publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult> {
    const creds = credentials as ShopifyCredentials;
    const domain = creds.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${domain}/admin/api/2024-01/products.json`;

    const shopifyProduct = {
      product: {
        title: product.title,
        body_html: product.description || '',
        variants: [{
          price: product.price,
          sku: product.sku,
          inventory_quantity: product.quantity,
          inventory_management: "shopify",
        }],
        images: product.images
          .filter(img => img && img.startsWith('http'))
          .map(src => ({ src })),
        status: "active",
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': creds.accessToken,
        },
        body: JSON.stringify(shopifyProduct),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Shopify API error (${response.status})`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.errors) {
            errorMessage = typeof parsed.errors === 'string' 
              ? parsed.errors 
              : JSON.stringify(parsed.errors);
          }
        } catch {}
        return { success: false, externalId: '', error: errorMessage };
      }

      const data = await response.json();
      const createdProduct = data.product;
      
      return {
        success: true,
        externalId: String(createdProduct.id),
        listingUrl: `https://${domain}/admin/products/${createdProduct.id}`,
      };
    } catch (err: any) {
      return {
        success: false,
        externalId: '',
        error: `Failed to connect to Shopify: ${err.message}`,
      };
    }
  }
};
