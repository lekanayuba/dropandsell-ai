export interface MarketplaceVariation {
  type: string;
  value: string;
  price?: string;
  quantity?: number;
  available?: boolean;
  image?: string;
}

export interface MarketplaceProduct {
  title: string;
  description: string;
  price: string;
  sku: string;
  quantity: number;
  images: string[];
  deliveryType: string;
  deliveryCost: string;
  categoryId?: string;
  variations?: MarketplaceVariation[];
  brand?: string;
  attributes?: Record<string, any>;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  listingUrl?: string;
  error?: string;
  isPolicyError?: boolean;
  isShippingLocationError?: boolean;
  errorCodes?: string[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  status: 'connected' | 'not_connected' | 'invalid';
}

export interface MarketplaceProvider {
  publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult>;
  validateCredentials(credentials: any): { valid: boolean; error?: string };
  testConnection(credentials: any): Promise<TestConnectionResult>;
}

export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
}

export interface EbayCredentials {
  appId: string;
  certId: string;
  devId: string;
  authToken: string;
  siteId?: string;
}

export interface AmazonCredentials {
  sellerId: string;
  accessKeyId: string;
  secretKey: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  region?: string;
}

export interface TikTokShopCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopId?: string;
  shopName?: string;
  shopCipher?: string;
}

export interface JumiaCredentials {
  apiKey: string;
  userId: string;
  apiUrl: string;
  country: string;
  email?: string;
}
