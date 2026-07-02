import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult } from "./types";
import { shopifyProvider } from "./shopify";
import { ebayProvider } from "./ebay";
import { amazonProvider } from "./amazon";
import { tiktokShopProvider } from "./tiktokshop";
import { jumiaProvider } from "./jumia";

const providers: Record<string, MarketplaceProvider> = {
  shopify: shopifyProvider,
  ebay: ebayProvider,
  amazon: amazonProvider,
  tiktokshop: tiktokShopProvider,
  jumia: jumiaProvider,
};

export function getMarketplaceProvider(platform: string): MarketplaceProvider | null {
  return providers[platform.toLowerCase()] || null;
}

export async function testMarketplaceConnection(
  platform: string,
  credentials: any,
): Promise<TestConnectionResult> {
  const provider = getMarketplaceProvider(platform);
  if (!provider) {
    return { success: false, status: 'not_connected' as const, message: `Marketplace "${platform}" is not supported.` };
  }

  const validation = provider.validateCredentials(credentials);
  if (!validation.valid) {
    return { success: false, status: 'invalid' as const, message: `Invalid credentials: ${validation.error}` };
  }

  return provider.testConnection(credentials);
}

export async function publishToMarketplace(
  platform: string,
  credentials: any,
  product: MarketplaceProduct,
): Promise<PublishResult> {
  const provider = getMarketplaceProvider(platform);
  if (!provider) {
    return {
      success: false,
      externalId: '',
      error: `Marketplace "${platform}" is not yet supported. Supported: Shopify, eBay, Amazon, TikTok Shop, Jumia.`,
    };
  }

  const validation = provider.validateCredentials(credentials);
  if (!validation.valid) {
    return {
      success: false,
      externalId: '',
      error: `Invalid store credentials: ${validation.error}`,
    };
  }

  return provider.publishProduct(credentials, product);
}

export type { MarketplaceProduct, PublishResult, TestConnectionResult };
