import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult, JumiaCredentials } from "./types";
import crypto from "crypto";

const JUMIA_COUNTRIES: Record<string, { name: string; currency: string; domain: string; apiUrl: string }> = {
  'ng': { name: 'Nigeria', currency: 'NGN', domain: 'jumia.com.ng', apiUrl: 'https://seller-api.jumia.com.ng' },
  'ke': { name: 'Kenya', currency: 'KES', domain: 'jumia.co.ke', apiUrl: 'https://seller-api.jumia.co.ke' },
  'eg': { name: 'Egypt', currency: 'EGP', domain: 'jumia.com.eg', apiUrl: 'https://seller-api.jumia.com.eg' },
  'gh': { name: 'Ghana', currency: 'GHS', domain: 'jumia.com.gh', apiUrl: 'https://seller-api.jumia.com.gh' },
  'ci': { name: "Côte d'Ivoire", currency: 'XOF', domain: 'jumia.ci', apiUrl: 'https://seller-api.jumia.ci' },
  'sn': { name: 'Senegal', currency: 'XOF', domain: 'jumia.sn', apiUrl: 'https://seller-api.jumia.sn' },
  'tn': { name: 'Tunisia', currency: 'TND', domain: 'jumia.com.tn', apiUrl: 'https://seller-api.jumia.com.tn' },
  'ma': { name: 'Morocco', currency: 'MAD', domain: 'jumia.ma', apiUrl: 'https://seller-api.jumia.ma' },
  'ug': { name: 'Uganda', currency: 'UGX', domain: 'jumia.ug', apiUrl: 'https://seller-api.jumia.ug' },
  'tz': { name: 'Tanzania', currency: 'TZS', domain: 'jumia.co.tz', apiUrl: 'https://seller-api.jumia.co.tz' },
  'cm': { name: 'Cameroon', currency: 'XAF', domain: 'jumia.cm', apiUrl: 'https://seller-api.jumia.cm' },
  'dz': { name: 'Algeria', currency: 'DZD', domain: 'jumia.dz', apiUrl: 'https://seller-api.jumia.dz' },
};

export { JUMIA_COUNTRIES };

function generateSignature(params: Record<string, string>, apiKey: string): string {
  const sorted = Object.keys(params).sort();
  const queryString = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  return crypto.createHmac('sha256', apiKey).update(queryString).digest('hex');
}

function buildApiUrl(baseUrl: string, action: string, userId: string, apiKey: string, extraParams?: Record<string, string>): string {
  const timestamp = new Date().toISOString();
  const params: Record<string, string> = {
    Action: action,
    Format: 'JSON',
    Timestamp: timestamp,
    UserID: userId,
    Version: '1.0',
    ...extraParams,
  };

  const signature = generateSignature(params, apiKey);
  params['Signature'] = signature;

  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${baseUrl}?${qs}`;
}

function getValidatedApiUrl(creds: JumiaCredentials): string {
  const country = creds.country?.toLowerCase();
  const validUrl = country ? JUMIA_COUNTRIES[country]?.apiUrl : null;
  if (!validUrl) {
    throw new Error(`Unsupported Jumia country: ${creds.country}`);
  }
  return validUrl;
}

async function jumiaApiRequest(
  baseUrl: string,
  action: string,
  userId: string,
  apiKey: string,
  method: string = 'GET',
  extraParams?: Record<string, string>,
  body?: string
): Promise<any> {
  const url = buildApiUrl(baseUrl, action, userId, apiKey, extraParams);

  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/xml';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `Jumia API error (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.ErrorResponse?.Head?.ErrorMessage || parsed?.message || msg;
    } catch {
      const xmlMatch = text.match(/<Message>(.*?)<\/Message>/);
      if (xmlMatch) msg = xmlMatch[1];
    }
    throw new Error(msg);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<ErrorResponse>') || text.includes('<Error>')) {
      const msgMatch = text.match(/<Message>(.*?)<\/Message>/);
      throw new Error(msgMatch?.[1] || `Jumia API error`);
    }
    throw new Error(`Unexpected Jumia API response format`);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeDescription(desc: string): string {
  return desc
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/https?:\/\/[^\s<>"]+/gi, '')
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '')
    .replace(/\d{10,}/g, '')
    .trim();
}

export const jumiaProvider: MarketplaceProvider = {
  validateCredentials(credentials: any): { valid: boolean; error?: string } {
    const creds = credentials as JumiaCredentials;
    if (!creds?.apiKey) return { valid: false, error: "Jumia API Key is required" };
    if (!creds?.userId) return { valid: false, error: "Jumia User ID (email) is required" };
    if (!creds?.apiUrl) return { valid: false, error: "Jumia API URL is required" };
    if (!creds?.country) return { valid: false, error: "Jumia country is required" };
    return { valid: true };
  },

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    const creds = credentials as JumiaCredentials;

    try {
      const apiUrl = getValidatedApiUrl(creds);
      const result = await jumiaApiRequest(
        apiUrl,
        'GetProducts',
        creds.userId,
        creds.apiKey,
        'GET',
        { Limit: '1' }
      );

      if (result?.ErrorResponse) {
        const msg = result.ErrorResponse?.Head?.ErrorMessage || 'Authentication failed';
        return { success: false, status: 'invalid', message: `Jumia connection failed: ${msg}` };
      }

      const country = JUMIA_COUNTRIES[creds.country];
      return {
        success: true,
        status: 'connected',
        message: `Connected to Jumia ${country?.name || creds.country} successfully`
      };
    } catch (err: any) {
      return { success: false, status: 'invalid', message: `Jumia connection failed: ${err.message}` };
    }
  },

  async publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult> {
    const creds = credentials as JumiaCredentials;
    const country = JUMIA_COUNTRIES[creds.country];

    try {
      const apiUrl = getValidatedApiUrl(creds);
      const title = escapeXml(product.title.substring(0, 255));
      const description = escapeXml(sanitizeDescription(product.description || product.title));
      const sku = escapeXml(product.sku);

      let imagesXml = '';
      if (product.images && product.images.length > 0) {
        imagesXml = '<Images>';
        product.images.forEach((img, i) => {
          if (i === 0) {
            imagesXml += `<Image>${escapeXml(img)}</Image>`;
          } else {
            imagesXml += `<Image>${escapeXml(img)}</Image>`;
          }
        });
        imagesXml += '</Images>';
      }

      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <Product>
    <SellerSku>${sku}</SellerSku>
    <Name>${title}</Name>
    <Description><![CDATA[${sanitizeDescription(product.description || product.title)}]]></Description>
    <Brand>Unbranded</Brand>
    <Price>${product.price}</Price>
    <SalePrice>${product.price}</SalePrice>
    <Quantity>${product.quantity}</Quantity>
    <ProductId>${sku}</ProductId>
    <PrimaryCategory>1</PrimaryCategory>
    <ShipmentType>${product.deliveryType === 'free' ? 'dropship' : 'crossdocking'}</ShipmentType>
    ${imagesXml}
  </Product>
</Request>`;

      const result = await jumiaApiRequest(
        apiUrl,
        'ProductCreate',
        creds.userId,
        creds.apiKey,
        'POST',
        {},
        xmlBody
      );

      if (result?.ErrorResponse) {
        const msg = result.ErrorResponse?.Head?.ErrorMessage || 'Product creation failed';
        return { success: false, externalId: '', error: `Jumia error: ${msg}` };
      }

      const feedId = result?.SuccessResponse?.Head?.RequestId || `jumia-${Date.now()}`;

      return {
        success: true,
        externalId: feedId,
        listingUrl: country ? `https://www.${country.domain}` : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        externalId: '',
        error: `Failed to publish to Jumia: ${err.message}`,
      };
    }
  }
};

export async function fetchJumiaOrders(creds: JumiaCredentials, createdAfter?: string): Promise<any[]> {
  const apiUrl = getValidatedApiUrl(creds);
  const extraParams: Record<string, string> = {
    SortBy: 'created_at',
    SortDirection: 'DESC',
    Limit: '100',
  };
  if (createdAfter) {
    extraParams['CreatedAfter'] = createdAfter;
  }

  const result = await jumiaApiRequest(
    apiUrl,
    'GetOrders',
    creds.userId,
    creds.apiKey,
    'GET',
    extraParams
  );

  if (result?.ErrorResponse) {
    throw new Error(result.ErrorResponse?.Head?.ErrorMessage || 'Failed to fetch orders');
  }

  const orders = result?.SuccessResponse?.Body?.Orders?.Order;
  if (!orders) return [];
  return Array.isArray(orders) ? orders : [orders];
}

export async function fetchJumiaOrderItems(creds: JumiaCredentials, orderId: string): Promise<any[]> {
  const apiUrl = getValidatedApiUrl(creds);
  const result = await jumiaApiRequest(
    apiUrl,
    'GetOrderItems',
    creds.userId,
    creds.apiKey,
    'GET',
    { OrderId: orderId }
  );

  if (result?.ErrorResponse) {
    throw new Error(result.ErrorResponse?.Head?.ErrorMessage || 'Failed to fetch order items');
  }

  const items = result?.SuccessResponse?.Body?.OrderItems?.OrderItem;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

export async function setJumiaOrderReadyToShip(creds: JumiaCredentials, orderItemIds: string[], trackingNumber: string, shippingProvider: string): Promise<any> {
  const apiUrl = getValidatedApiUrl(creds);
  const params: Record<string, string> = {
    ShippingProvider: shippingProvider,
    TrackingNumber: trackingNumber,
  };
  orderItemIds.forEach((id, i) => {
    params[`OrderItemIds[${i}]`] = id;
  });

  return jumiaApiRequest(
    apiUrl,
    'SetStatusToReadyToShip',
    creds.userId,
    creds.apiKey,
    'POST',
    params
  );
}
