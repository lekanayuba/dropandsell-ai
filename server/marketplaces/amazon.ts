import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult, AmazonCredentials } from "./types";
import crypto from "crypto";

export const amazonProvider: MarketplaceProvider = {
  validateCredentials(credentials: any): { valid: boolean; error?: string } {
    const creds = credentials as AmazonCredentials;
    if (!creds?.sellerId) return { valid: false, error: "Amazon Seller ID is required" };
    if (!creds?.accessKeyId) return { valid: false, error: "AWS Access Key ID is required" };
    if (!creds?.secretKey) return { valid: false, error: "AWS Secret Key is required" };
    if (!creds?.refreshToken) return { valid: false, error: "LWA Refresh Token is required" };
    if (!creds?.clientId) return { valid: false, error: "LWA Client ID is required" };
    if (!creds?.clientSecret) return { valid: false, error: "LWA Client Secret is required" };
    return { valid: true };
  },

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    const creds = credentials as AmazonCredentials;
    
    try {
      const accessToken = await getLwaAccessToken(creds);
      if (accessToken) {
        return { success: true, status: 'connected', message: 'Connected to Amazon SP-API successfully' };
      }
      return { success: false, status: 'invalid', message: 'Failed to obtain Amazon access token' };
    } catch (err: any) {
      return { success: false, status: 'invalid', message: `Amazon connection failed: ${err.message}` };
    }
  },

  async publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult> {
    const creds = credentials as AmazonCredentials;
    const region = creds.region || 'eu-west-1';
    const endpoint = region.startsWith('eu') 
      ? 'https://sellingpartnerapi-eu.amazon.com' 
      : 'https://sellingpartnerapi-na.amazon.com';
    const marketplaceId = getMarketplaceId(region);

    try {
      const accessToken = await getLwaAccessToken(creds);

      const feedContent = buildProductFeed(creds.sellerId, product);

      const createDocResponse = await spApiRequest(
        'POST',
        '/feeds/2021-06-30/documents',
        endpoint,
        region,
        creds,
        accessToken,
        JSON.stringify({ contentType: 'text/xml; charset=UTF-8' })
      );

      if (!createDocResponse.ok) {
        const errText = await createDocResponse.text();
        let msg = `Failed to create feed document (${createDocResponse.status})`;
        try { msg = JSON.parse(errText).errors?.[0]?.message || msg; } catch {}
        return { success: false, externalId: '', error: msg };
      }

      const docData = await createDocResponse.json();
      const feedDocumentId = docData.feedDocumentId;
      const uploadUrl = docData.url;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
        body: feedContent,
      });

      if (!uploadResponse.ok) {
        return { success: false, externalId: '', error: `Failed to upload feed content (${uploadResponse.status})` };
      }

      const createFeedResponse = await spApiRequest(
        'POST',
        '/feeds/2021-06-30/feeds',
        endpoint,
        region,
        creds,
        accessToken,
        JSON.stringify({
          feedType: 'POST_PRODUCT_DATA',
          marketplaceIds: [marketplaceId],
          inputFeedDocumentId: feedDocumentId,
        })
      );

      if (!createFeedResponse.ok) {
        const errText = await createFeedResponse.text();
        let msg = `Failed to create feed (${createFeedResponse.status})`;
        try { msg = JSON.parse(errText).errors?.[0]?.message || msg; } catch {}
        return { success: false, externalId: '', error: msg };
      }

      const feedData = await createFeedResponse.json();
      const feedId = feedData.feedId;

      const sellerCentralDomain = region.startsWith('eu')
        ? 'sellercentral.amazon.co.uk'
        : 'sellercentral.amazon.com';

      return {
        success: true,
        externalId: feedId,
        listingUrl: `https://${sellerCentralDomain}/inventory`,
      };
    } catch (err: any) {
      return {
        success: false,
        externalId: '',
        error: `Failed to connect to Amazon: ${err.message}`,
      };
    }
  }
};

async function getLwaAccessToken(creds: AmazonCredentials): Promise<string> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken!,
      client_id: creds.clientId!,
      client_secret: creds.clientSecret!,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`LWA token request failed (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

async function spApiRequest(
  method: string,
  path: string,
  endpoint: string,
  region: string,
  creds: AmazonCredentials,
  accessToken: string,
  body?: string,
): Promise<Response> {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);
  const host = new URL(endpoint).host;

  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'host': host,
    'x-amz-access-token': accessToken,
    'x-amz-date': timestamp,
  };

  const signedHeaderKeys = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k}:${headers[k]}`)
    .join('\n');

  const canonicalRequest = [
    method, path, '',
    canonicalHeaders + '\n', signedHeaderKeys, bodyHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/execute-api/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', timestamp, credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = getSignatureKey(creds.secretKey, date, region, 'execute-api');
  const signature = crypto.createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  delete headers['host'];

  return fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body || undefined,
  });
}

function getMarketplaceId(region: string): string {
  const marketplaces: Record<string, string> = {
    'eu-west-1': 'A1F83G8C2ARO7P',
    'us-east-1': 'ATVPDKIKX0DER',
    'us-west-2': 'ATVPDKIKX0DER',
  };
  return marketplaces[region] || 'A1F83G8C2ARO7P';
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

function buildProductFeed(sellerId: string, product: MarketplaceProduct): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${sellerId}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>
  <Message>
    <MessageID>1</MessageID>
    <OperationType>Update</OperationType>
    <Product>
      <SKU>${product.sku}</SKU>
      <StandardProductID>
        <Type>EAN</Type>
        <Value>${product.sku}</Value>
      </StandardProductID>
      <Condition>
        <ConditionType>New</ConditionType>
      </Condition>
      <DescriptionData>
        <Title>${product.title}</Title>
        <Description>${product.description || product.title}</Description>
      </DescriptionData>
    </Product>
  </Message>
</AmazonEnvelope>`;
}
