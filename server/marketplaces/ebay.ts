import type { MarketplaceProvider, MarketplaceProduct, PublishResult, TestConnectionResult, EbayCredentials } from "./types";

const SITE_CONFIG: Record<string, { currency: string; country: string; shippingService: string; domain: string; location: string }> = {
  '0': { currency: 'USD', country: 'US', shippingService: 'USPSMedia', domain: 'www.ebay.com', location: 'United States' },
  '2': { currency: 'CAD', country: 'CA', shippingService: 'CA_PostRegularParcel', domain: 'www.ebay.ca', location: 'Canada' },
  '3': { currency: 'GBP', country: 'GB', shippingService: 'UK_RoyalMailSecondClassStandard', domain: 'www.ebay.co.uk', location: 'United Kingdom' },
  '15': { currency: 'AUD', country: 'AU', shippingService: 'AU_Regular', domain: 'www.ebay.com.au', location: 'Australia' },
  '16': { currency: 'EUR', country: 'AT', shippingService: 'AT_StandardVersand', domain: 'www.ebay.at', location: 'Austria' },
  '23': { currency: 'EUR', country: 'BE', shippingService: 'BE_StandardDelivery', domain: 'www.ebay.be', location: 'Belgium' },
  '71': { currency: 'EUR', country: 'FR', shippingService: 'FR_ColiposteColissimo', domain: 'www.ebay.fr', location: 'France' },
  '77': { currency: 'EUR', country: 'DE', shippingService: 'DE_DHLPaket', domain: 'www.ebay.de', location: 'Germany' },
  '101': { currency: 'EUR', country: 'IT', shippingService: 'IT_PosteItaliane', domain: 'www.ebay.it', location: 'Italy' },
  '146': { currency: 'EUR', country: 'NL', shippingService: 'NL_PostNLStandard', domain: 'www.ebay.nl', location: 'Netherlands' },
  '186': { currency: 'EUR', country: 'ES', shippingService: 'ES_CorreosDeEspana', domain: 'www.ebay.es', location: 'Spain' },
  '193': { currency: 'CHF', country: 'CH', shippingService: 'CH_PostPac', domain: 'www.ebay.ch', location: 'Switzerland' },
  '205': { currency: 'EUR', country: 'IE', shippingService: 'IE_AnPostRegistered', domain: 'www.ebay.ie', location: 'Ireland' },
  '211': { currency: 'PHP', country: 'PH', shippingService: 'StandardDelivery', domain: 'www.ebay.ph', location: 'Philippines' },
  '212': { currency: 'PLN', country: 'PL', shippingService: 'PL_PostPolska', domain: 'www.ebay.pl', location: 'Poland' },
  '215': { currency: 'SGD', country: 'SG', shippingService: 'SG_SingPostStandard', domain: 'www.ebay.com.sg', location: 'Singapore' },
  '216': { currency: 'SEK', country: 'SE', shippingService: 'StandardDelivery', domain: 'www.ebay.se', location: 'Sweden' },
};

function getFullCredentials(credentials: any): EbayCredentials {
  const creds = credentials as EbayCredentials;
  return {
    authToken: creds.authToken,
    appId: creds.appId || process.env.EBAY_APP_ID || '',
    certId: creds.certId || process.env.EBAY_CERT_ID || '',
    devId: creds.devId || process.env.EBAY_DEV_ID || '',
    siteId: creds.siteId || '3',
  };
}

function makeEbayHeaders(creds: EbayCredentials, callName: string): Record<string, string> {
  return {
    'Content-Type': 'text/xml',
    'X-EBAY-API-SITEID': creds.siteId || '3',
    'X-EBAY-API-COMPATIBILITY-LEVEL': '1309',
    'X-EBAY-API-CALL-NAME': callName,
    'X-EBAY-API-APP-NAME': creds.appId,
    'X-EBAY-API-DEV-NAME': creds.devId,
    'X-EBAY-API-CERT-NAME': creds.certId,
    'X-EBAY-API-IAF-TOKEN': creds.authToken,
  };
}

// Maps legacy Trading API site IDs to modern REST marketplace IDs. Used by the
// Sell Metadata / Account REST calls that have replaced deprecated Trading API
// calls (e.g. GetCategoryFeatures -> getItemConditionPolicies).
const SITE_TO_MARKETPLACE: Record<string, string> = {
  '0': 'EBAY_US', '2': 'EBAY_CA', '3': 'EBAY_GB', '15': 'EBAY_AU',
  '16': 'EBAY_AT', '23': 'EBAY_BE', '71': 'EBAY_FR', '77': 'EBAY_DE',
  '101': 'EBAY_IT', '146': 'EBAY_NL', '186': 'EBAY_ES', '193': 'EBAY_CH',
  '205': 'EBAY_IE', '211': 'EBAY_PH', '212': 'EBAY_PL', '215': 'EBAY_SG',
  '216': 'EBAY_SE',
};

/**
 * Tiny in-memory TTL cache for the read-only Trading-API & REST-API lookups
 * we make on every publish. eBay enforces strict per-call daily quotas
 * (error code 518 — "Your application has exceeded usage limit on this
 * call"), and the same lookups (seller location, business policies, category
 * features, etc.) almost never change between publishes for the same seller.
 * Caching them dramatically reduces our call volume and protects the whole
 * platform from one heavy user blowing the daily budget for everybody.
 */
const _ebayCache = new Map<string, { value: any; expiresAt: number }>();
async function _cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = _ebayCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  // Don't cache "null" results forever — retry sooner so transient failures self-heal.
  const effectiveTtl = (value === null || value === undefined) ? Math.min(ttlMs, 60_000) : ttlMs;
  _ebayCache.set(key, { value, expiresAt: now + effectiveTtl });
  return value;
}
function _tokenKey(token: string | undefined): string {
  if (!token) return 'no-token';
  // Use the last 24 chars as a cheap stable identifier (don't log full token).
  return token.slice(-24);
}

// eBay image requirements (Trading API / EPS):
//   - Format: JPEG, PNG, GIF, BMP, TIFF (we always normalise to JPEG to keep file size down)
//   - Min: 500 px on the longest side (eBay rejects/upscales below this — we upscale ourselves
//          for predictable quality, especially for variation swatches that are often tiny)
//   - Recommended: 1600 px on the longest side (zoom & enhanced viewing)
//   - Max: 9000 px on the longest side, max 12 MB file size
//   - Backgrounds with alpha get flattened to white (eBay strips alpha anyway)
const EBAY_MIN_LONGEST = 500;
const EBAY_TARGET_LONGEST = 1600;
const EBAY_MAX_LONGEST = 9000;
const EBAY_MAX_BYTES = 11 * 1024 * 1024; // keep a 1 MB safety margin under the 12 MB limit

/**
 * Download a remote image and resize/normalise it so it satisfies eBay's
 * picture requirements for both gallery and variation pictures.
 * Returns a JPEG buffer ready to be uploaded as binary to EPS, or null on failure.
 */
async function fetchAndResizeForEbay(imageUrl: string): Promise<Buffer | null> {
  try {
    let input: Buffer;
    // Accept inline data URLs (the upload endpoint returns these for images
    // chosen via "Add Pic" on a variation row). eBay rejects data: URLs in
    // <PictureURL>, so we decode the base64 here, resize, and upload as binary.
    if (imageUrl.startsWith('data:')) {
      const m = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!m) {
        console.warn('[eBay Image Resize] Malformed data URL');
        return null;
      }
      input = Buffer.from(m[1], 'base64');
    } else {
      const httpsUrl = imageUrl.replace(/^http:\/\//i, 'https://');
      const res = await fetch(httpsUrl, { redirect: 'follow' });
      if (!res.ok) {
        console.warn(`[eBay Image Resize] Fetch failed ${res.status} for ${imageUrl}`);
        return null;
      }
      const arr = await res.arrayBuffer();
      input = Buffer.from(arr);
    }
    const sharp = (await import('sharp')).default;
    const img = sharp(input, { failOn: 'none' }).rotate(); // honour EXIF orientation

    const meta = await img.metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (!width || !height) {
      console.warn(`[eBay Image Resize] No dimensions for ${imageUrl}`);
      return null;
    }
    const longest = Math.max(width, height);

    // Decide target longest-side dimension.
    let target: number;
    if (longest < EBAY_MIN_LONGEST) {
      // Upscale small images to satisfy eBay's 500px minimum.
      target = EBAY_MIN_LONGEST;
    } else if (longest > EBAY_TARGET_LONGEST) {
      // Downscale large images to the recommended size for fast loading & smaller files.
      target = EBAY_TARGET_LONGEST;
    } else {
      target = longest; // already in the sweet spot
    }
    target = Math.min(target, EBAY_MAX_LONGEST);

    let pipeline = img.resize({
      width: width >= height ? target : undefined,
      height: height > width ? target : undefined,
      fit: 'inside',
      withoutEnlargement: false, // allow upscaling to meet the 500px minimum
      kernel: 'lanczos3',
    });

    // Flatten transparency to white so eBay accepts the picture.
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });

    // First pass: high quality JPEG.
    let out = await pipeline.jpeg({ quality: 90, progressive: true, mozjpeg: true }).toBuffer();
    // If the file is still over the eBay limit, drop quality progressively.
    if (out.length > EBAY_MAX_BYTES) {
      for (const q of [82, 75, 68, 60]) {
        out = await sharp(input, { failOn: 'none' })
          .rotate()
          .resize({
            width: width >= height ? target : undefined,
            height: height > width ? target : undefined,
            fit: 'inside',
            withoutEnlargement: false,
            kernel: 'lanczos3',
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: q, progressive: true, mozjpeg: true })
          .toBuffer();
        if (out.length <= EBAY_MAX_BYTES) break;
      }
    }
    return out;
  } catch (err: any) {
    console.warn(`[eBay Image Resize] Error for ${imageUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Upload a resized image buffer to eBay's Picture Services (EPS) using a
 * multipart/form-data POST. Required because the Trading API expects the XML
 * envelope as the first part and the binary image as the second part, with a
 * specific Content-ID header on the image part.
 * Returns the full eBay-hosted URL on success, null on failure.
 */
async function uploadBinaryToEbayEps(creds: EbayCredentials, jpegBuffer: Buffer): Promise<string | null> {
  const boundary = `----dropandsell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <PictureSet>Supersize</PictureSet>
  <PictureUploadPolicy>Add</PictureUploadPolicy>
</UploadSiteHostedPicturesRequest>`;

  const headPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="XML Payload"\r\n` +
    `Content-Type: text/xml;charset=utf-8\r\n\r\n` +
    xml + `\r\n`,
    'utf8'
  );
  const imageHeader = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"; filename="image.jpg"\r\n` +
    `Content-Transfer-Encoding: binary\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`,
    'utf8'
  );
  const tailPart = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([headPart, imageHeader, jpegBuffer, tailPart]);

  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        ...makeEbayHeaders(creds, 'UploadSiteHostedPictures'),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });
    const text = await res.text();
    const ack = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
    if (ack === 'Success' || ack === 'Warning') {
      const fullUrl = text.match(/<FullURL>([^<]+)<\/FullURL>/)?.[1];
      if (fullUrl) return fullUrl;
    }
    const err = text.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1] || text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1] || `ack=${ack}`;
    console.warn(`[eBay EPS Binary] Upload failed: ${err}`);
    return null;
  } catch (err: any) {
    console.warn(`[eBay EPS Binary] Upload error: ${err.message}`);
    return null;
  }
}

/**
 * Upload a single image URL to eBay's Picture Services (EPS).
 * Strategy:
 *   1. Download the image, resize/normalise to eBay specs (JPEG, 500–1600 px longest side,
 *      white background, ≤11 MB), and upload as binary multipart. This guarantees the picture
 *      meets eBay's requirements regardless of the source resolution — critical for variation
 *      swatch images which are frequently below eBay's 500 px minimum.
 *   2. Fall back to the legacy ExternalPictureURL flow (eBay fetches the URL itself) if the
 *      binary upload fails — eBay will then attempt its own resize/validation.
 * Returns null if both strategies fail (caller falls back to original URL).
 */
async function uploadPictureToEbayEps(creds: EbayCredentials, imageUrl: string): Promise<string | null> {
  // Accept BOTH http(s) URLs AND inline data: URLs. Variation pictures uploaded
  // through the inventory editor's "Add Pic" come back as base64 data: URLs;
  // they MUST go through the binary upload path because eBay can't fetch them.
  if (!imageUrl || (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:'))) return null;

  // Strategy 1: download/decode → resize to eBay spec → upload as binary multipart.
  const jpegBuffer = await fetchAndResizeForEbay(imageUrl);
  if (jpegBuffer) {
    const hosted = await uploadBinaryToEbayEps(creds, jpegBuffer);
    if (hosted) return hosted;
  }

  // Strategy 2: ExternalPictureURL fallback (lets eBay fetch the original).
  // Only valid for http(s) — eBay can't fetch a data: URL.
  if (!imageUrl.startsWith('http')) return null;
  const httpsUrl = imageUrl.replace(/^http:\/\//i, 'https://');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ExternalPictureURL>${httpsUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</ExternalPictureURL>
  <PictureSet>Supersize</PictureSet>
  <PictureUploadPolicy>Add</PictureUploadPolicy>
</UploadSiteHostedPicturesRequest>`;
  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'UploadSiteHostedPictures'),
      body: xml,
    });
    const text = await res.text();
    const ack = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
    if (ack === 'Success' || ack === 'Warning') {
      const fullUrl = text.match(/<FullURL>([^<]+)<\/FullURL>/)?.[1];
      if (fullUrl) return fullUrl;
    }
    const err = text.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1] || text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1] || `ack=${ack}`;
    console.warn(`[eBay EPS] Upload failed for ${imageUrl}: ${err}`);
    return null;
  } catch (err: any) {
    console.warn(`[eBay EPS] Upload error for ${imageUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Convert an array of arbitrary product image URLs into eBay-hosted EPS URLs in parallel.
 * Falls back to the original URL (forced to HTTPS) if EPS upload fails for an individual image.
 */
export async function convertImagesForEbayPublic(creds: EbayCredentials, urls: string[]): Promise<string[]> {
  return convertImagesForEbay(creds, urls);
}

async function convertImagesForEbay(creds: EbayCredentials, urls: string[]): Promise<string[]> {
  // Accept both remote http(s) URLs AND inline data: URLs (variation pictures
  // uploaded through "Add Pic" come back as data: URLs and would otherwise be
  // silently dropped, leaving the variation with no image on eBay).
  const valid = urls.filter(u => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:')));
  if (valid.length === 0) return [];

  // Limit concurrency to 3 simultaneous uploads. Firing 9+ uploads in parallel
  // routinely triggered eBay's rate-limiter and silently dropped pictures from
  // the listing. With a small worker pool we get every picture through, even
  // for products with many colour-specific photos. We also retry once on
  // failure to absorb transient EPS hiccups.
  const results: string[] = new Array(valid.length);
  let nextIdx = 0;
  const worker = async () => {
    while (true) {
      const i = nextIdx++;
      if (i >= valid.length) return;
      const u = valid[i];
      let hosted = await uploadPictureToEbayEps(creds, u);
      if (!hosted) {
        // brief back-off then one retry
        await new Promise(r => setTimeout(r, 400));
        hosted = await uploadPictureToEbayEps(creds, u);
      }
      if (hosted) {
        results[i] = hosted;
      } else if (u.startsWith('data:')) {
        // Data URLs cannot be passed to eBay as-is, so signal failure.
        results[i] = '';
        console.warn(`[eBay EPS] All upload attempts failed for inline picture #${i + 1} (${(u.match(/^data:([^;]+)/) || [])[1] || 'data'}, ${Math.round(u.length / 1024)}KB) — picture will be missing from listing`);
      } else {
        // http URLs fall back to themselves so eBay can attempt its own fetch.
        results[i] = u.replace(/^http:\/\//i, 'https://');
        console.warn(`[eBay EPS] Falling back to source URL for picture #${i + 1}: ${u.slice(0, 80)}…`);
      }
    }
  };
  const concurrency = Math.min(3, valid.length);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

interface SellerProfiles {
  shippingProfileId?: string;
  returnProfileId?: string;
  paymentProfileId?: string;
}

/**
 * Generate a rich, eBay-ready HTML product description using OpenAI.
 * Highlights specifications, key features and benefits — formatted as semantic HTML
 * that eBay accepts in <Description>. Returns null on failure so caller can fall back
 * to the original description.
 */
export async function generateAIDescription(
  product: { title: string; description?: string; brand?: string; attributes?: any; categoryName?: string }
): Promise<string | null> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
    console.warn('[eBay AI Description] OpenAI key not configured — skipping AI description');
    return null;
  }
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL });

    const specs: Record<string, any> = {};
    const attrs = product.attributes || {};
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined) continue;
      if (typeof v === 'object') continue;
      const key = String(k);
      if (['vendorStock', 'priceHistory', 'variations', 'vendorShipping', 'imageMetadata', 'verifiedAt'].includes(key)) continue;
      specs[key] = v;
    }

    const sourceText = (product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);

    const prompt = `You are writing an eBay product listing description.

Product: ${product.title}
${product.brand ? `Brand: ${product.brand}` : ''}
${product.categoryName ? `Category: ${product.categoryName}` : ''}
${Object.keys(specs).length > 0 ? `Known attributes/specs: ${JSON.stringify(specs)}` : ''}
${sourceText ? `Source notes from vendor: ${sourceText}` : ''}

Write a complete, professional, buyer-focused HTML description for the eBay listing. Requirements:
- Start with a one-sentence opening hook describing what the product is and who it's for.
- Include a "Key Features" section as a <ul> with 4–7 specific, factual bullets drawn from the title, brand, attributes and source notes.
- Include a "Specifications" section as a <ul> with concrete spec lines (material, dimensions, capacity, colour, model, compatibility, weight, power, etc.) — only include specs you can reasonably infer or that are present in the input. Do not invent measurements you don't know; if unknown, omit them.
- Include a "What's in the Box" line if it can be inferred.
- Close with a short shipping/satisfaction line ("Fast dispatch, securely packaged. Buy with confidence.").
- Use only semantic HTML: <h3>, <p>, <ul>, <li>, <strong>. No <script>, no inline styles, no <img>, no external links, no class/id attributes.
- Keep total length 180–350 words.
- Do NOT mention competitor sellers, prices, vendor URLs, or other marketplaces.
- Do NOT include any disclaimer about being AI-generated.

Output ONLY the HTML body — no markdown fences, no commentary.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: 'system', content: 'You write concise, accurate, conversion-focused eBay product descriptions in clean semantic HTML.' },
        { role: 'user', content: prompt },
      ],
    });
    const html = completion.choices?.[0]?.message?.content?.trim();
    if (!html) return null;
    // Strip any accidental markdown fences.
    const clean = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return clean.length > 50 ? clean : null;
  } catch (err: any) {
    console.warn(`[eBay AI Description] Generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate an SEO-optimised eBay title (max 80 chars) for the product.
 * Returns null on failure so the caller can fall back to the original.
 */
export async function generateAITitle(
  product: { title: string; description?: string; brand?: string; attributes?: any; categoryName?: string }
): Promise<string | null> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL });
    const sourceText = (product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
    const attrs = product.attributes || {};
    const usable: Record<string, any> = {};
    for (const k of Object.keys(attrs)) {
      const v = (attrs as any)[k];
      if (v == null || typeof v === 'object') continue;
      if (['vendorStock', 'priceHistory', 'variations', 'vendorShipping', 'imageMetadata', 'verifiedAt', 'itemSpecifics'].includes(k)) continue;
      usable[k] = v;
    }
    const prompt = `Rewrite this product title for an eBay listing so buyers can find it via search.

Current title: ${product.title}
${product.brand ? `Brand: ${product.brand}` : ''}
${product.categoryName ? `Category: ${product.categoryName}` : ''}
${Object.keys(usable).length ? `Known attributes: ${JSON.stringify(usable)}` : ''}
${sourceText ? `Source notes: ${sourceText}` : ''}

Rules:
- 80 characters MAXIMUM (eBay's hard limit). Aim for 70–80.
- Front-load the most important keywords: Brand, Model/MPN, Product Type, key spec (size/colour/capacity), audience.
- Title Case. No ALL CAPS words except brand acronyms (e.g. USB, LED).
- No emojis, no punctuation marks like ! ? * or quotation marks. Hyphens and parentheses are OK.
- No words like "New", "Hot Sale", "Free Shipping", "Best", "Top Rated", "L@@K".
- Do not invent specifications you cannot infer.
- Output ONLY the rewritten title text on a single line. No quotes, no explanation.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 120,
      messages: [
        { role: 'system', content: 'You write concise, keyword-rich eBay listing titles that respect the 80-character limit.' },
        { role: 'user', content: prompt },
      ],
    });
    let title = completion.choices?.[0]?.message?.content?.trim() || '';
    title = title.replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!title) return null;
    if (title.length > 80) title = title.slice(0, 80).trim();
    return title.length >= 10 ? title : null;
  } catch (err: any) {
    console.warn(`[eBay AI Title] Generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate structured item specifics (Brand, MPN, Type, Colour, Material, ...)
 * the buyer can search and filter by on eBay. Returns a {Name -> Value} map or null.
 * Caller persists it to product.attributes.itemSpecifics so generateItemSpecificsXml
 * uses these reviewed values instead of guessing from the title.
 */
export async function generateAIItemSpecifics(
  product: { title: string; description?: string; brand?: string; attributes?: any; categoryName?: string }
): Promise<Record<string, string> | null> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL });
    const sourceText = (product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
    const attrs = product.attributes || {};
    const usable: Record<string, any> = {};
    for (const k of Object.keys(attrs)) {
      const v = (attrs as any)[k];
      if (v == null || typeof v === 'object') continue;
      if (['vendorStock', 'priceHistory', 'variations', 'vendorShipping', 'imageMetadata', 'verifiedAt', 'itemSpecifics'].includes(k)) continue;
      usable[k] = v;
    }
    const prompt = `Extract eBay Item Specifics for this product. These are the searchable filter fields buyers use on eBay (Brand, Type, MPN, Colour, Material, Size, Department, Model, Country/Region of Manufacture, etc.).

Product: ${product.title}
${product.brand ? `Brand: ${product.brand}` : ''}
${product.categoryName ? `Category: ${product.categoryName}` : ''}
${Object.keys(usable).length ? `Known attributes: ${JSON.stringify(usable)}` : ''}
${sourceText ? `Source notes: ${sourceText}` : ''}

Return a JSON object whose keys are eBay item specific names (Title Case, e.g. "Brand", "Type", "MPN", "Colour", "Material", "Model", "Size", "Department", "Country/Region of Manufacture", "Features", "Power Source", "Connectivity", "Compatible Operating System", "Pattern", "Style", "Manufacturer Warranty", "EAN", "Product Line", "Display Type", "Labels & Certifications") and whose values are short strings (max 60 chars each) extracted from the product information. Rules:
- Always include "Brand" and "MPN" (use the SKU for MPN if unknown — never empty).
- Only include a field if you have a defensible value from the input. Do NOT invent measurements or model numbers.
- Use "Does Not Apply" sparingly — prefer to omit a field rather than fill it with "Does Not Apply" unless the field is mandatory.
- Use British spelling for Colour and Grey.
- Keep values concise — no full sentences, no marketing language.
- Return at most 12 fields.

Output ONLY a single valid JSON object, no markdown fences, no commentary.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You extract structured product attributes from listing data and return strict JSON.' },
        { role: 'user', content: prompt },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const name = String(k).trim();
      if (!name || name.length > 60) continue;
      let value: string;
      if (typeof v === 'string') value = v.trim();
      else if (typeof v === 'number' || typeof v === 'boolean') value = String(v);
      else continue;
      if (!value || value.length > 60) continue;
      cleaned[name] = value;
    }
    if (Object.keys(cleaned).length === 0) return null;
    // Ensure MPN is present
    if (!cleaned['MPN'] && !cleaned['Manufacturer Part Number']) {
      cleaned['MPN'] = 'Does Not Apply';
    }
    return cleaned;
  } catch (err: any) {
    console.warn(`[eBay AI Specifics] Generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetch the seller's actual registered country & postal code from eBay.
 * Used as the item Location/Country on listings so it matches the origin
 * declared in their shipping policy (eBay error 240 = mismatch).
 * Falls back to null on failure — caller should then use site defaults.
 */
async function getSellerLocation(creds: EbayCredentials): Promise<{ country: string; location: string; postalCode?: string } | null> {
  return _cached(`sellerLoc:${_tokenKey(creds.authToken)}`, 60 * 60 * 1000, () => _getSellerLocationUncached(creds));
}
async function _getSellerLocationUncached(creds: EbayCredentials): Promise<{ country: string; location: string; postalCode?: string } | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
</GetUserRequest>`;
  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'GetUser'),
      body: xml,
    });
    const text = await res.text();
    const country = text.match(/<RegistrationAddress>[\s\S]*?<Country>(\w{2})<\/Country>/)?.[1]
      || text.match(/<SellerInfo>[\s\S]*?<SellerBusinessType[\s\S]*?<\/SellerBusinessType>[\s\S]*?<\/SellerInfo>/)?.[0]?.match(/<Country>(\w{2})<\/Country>/)?.[1]
      || text.match(/<Country>(\w{2})<\/Country>/)?.[1];
    const postal = text.match(/<RegistrationAddress>[\s\S]*?<PostalCode>([^<]+)<\/PostalCode>/)?.[1]
      || text.match(/<PostalCode>([^<]+)<\/PostalCode>/)?.[1];
    const cityMatch = text.match(/<RegistrationAddress>[\s\S]*?<CityName>([^<]+)<\/CityName>/)?.[1];
    if (!country) return null;
    const COUNTRY_NAMES: Record<string, string> = {
      GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia',
      IE: 'Ireland', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
      NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland',
      PL: 'Poland', SE: 'Sweden', NG: 'Nigeria', ZA: 'South Africa',
      KE: 'Kenya', GH: 'Ghana', SG: 'Singapore', PH: 'Philippines',
      AE: 'United Arab Emirates', IN: 'India', NZ: 'New Zealand',
    };
    const countryName = COUNTRY_NAMES[country] || country;
    // eBay limits the Item.Location field — strictest sites cap at 30 chars
    // (Taiwan), most others at 45. We cap at 45 and gracefully fall back to
    // shorter forms so we never exceed the limit (eBay error 21919189).
    const ITEM_LOCATION_MAX = 45;
    const fullLocation = cityMatch ? `${cityMatch}, ${countryName}` : countryName;
    let location = fullLocation;
    if (location.length > ITEM_LOCATION_MAX) {
      location = cityMatch && cityMatch.length <= ITEM_LOCATION_MAX ? cityMatch : countryName;
      if (location.length > ITEM_LOCATION_MAX) location = country;
    }
    console.log(`[eBay] Seller registered country=${country}, location="${location}" (${location.length} chars), postal=${postal || 'n/a'}`);
    return { country, location, postalCode: postal };
  } catch (err: any) {
    console.warn(`[eBay] getSellerLocation failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetches the seller's configured inventory ship-from locations via the
 * Sell Inventory REST API. This is what eBay actually uses to validate
 * Item.Location against the shipping policy (eBay error 240). When present,
 * this is more accurate than the seller's registration address.
 */
async function getSellerInventoryLocation(creds: EbayCredentials): Promise<{ country: string; location: string; postalCode?: string } | null> {
  return _cached(`invLoc:${_tokenKey(creds.authToken)}`, 60 * 60 * 1000, () => _getSellerInventoryLocationUncached(creds));
}
async function _getSellerInventoryLocationUncached(creds: EbayCredentials): Promise<{ country: string; location: string; postalCode?: string } | null> {
  try {
    const res = await fetch('https://api.ebay.com/sell/inventory/v1/location?limit=25', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${creds.authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.log(`[eBay] getSellerInventoryLocation HTTP ${res.status} — skipping`);
      return null;
    }
    const data: any = await res.json();
    const locations: any[] = Array.isArray(data?.locations) ? data.locations : [];
    if (locations.length === 0) return null;
    const enabled = locations.find(l => l?.merchantLocationStatus === 'ENABLED') || locations[0];
    const addr = enabled?.location?.address;
    if (!addr?.country) return null;
    const COUNTRY_NAMES: Record<string, string> = {
      GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia',
      IE: 'Ireland', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
      NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland',
      PL: 'Poland', SE: 'Sweden', NG: 'Nigeria', ZA: 'South Africa',
      KE: 'Kenya', GH: 'Ghana', SG: 'Singapore', PH: 'Philippines',
      AE: 'United Arab Emirates', IN: 'India', NZ: 'New Zealand',
      CN: 'China', HK: 'Hong Kong', TW: 'Taiwan', JP: 'Japan', KR: 'South Korea',
    };
    const countryName = COUNTRY_NAMES[addr.country] || addr.country;
    const ITEM_LOCATION_MAX = 45;
    const city = (addr.city || '').toString().trim();
    let location = city ? `${city}, ${countryName}` : countryName;
    if (location.length > ITEM_LOCATION_MAX) {
      location = city && city.length <= ITEM_LOCATION_MAX ? city : countryName;
      if (location.length > ITEM_LOCATION_MAX) location = addr.country;
    }
    console.log(`[eBay] Inventory location used: country=${addr.country}, location="${location}", postal=${addr.postalCode || 'n/a'}`);
    return { country: addr.country, location, postalCode: addr.postalCode };
  } catch (err: any) {
    console.warn(`[eBay] getSellerInventoryLocation failed: ${err.message}`);
    return null;
  }
}

/**
 * Inspect each candidate shipping policy and pick the one whose services
 * best match the seller's country. eBay error 240 fires when the chosen
 * policy contains a postage service that ships from a different country
 * than the listing's <Location>. eBay shipping service codes are prefixed
 * by region (e.g. UK_*, US_*, AU_*, DE_*); we score on that prefix.
 */
async function pickShippingPolicyMatchingCountry(
  creds: EbayCredentials,
  candidates: Array<{ id: string; name: string; isDefault: boolean }>,
  country: string,
): Promise<{ id: string; name: string } | null> {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const COUNTRY_PREFIX: Record<string, string> = {
    GB: 'UK', US: 'US', CA: 'CA', AU: 'AU', DE: 'DE', FR: 'FR', IT: 'IT',
    ES: 'ES', IE: 'IE', NL: 'NL', BE: 'BE', AT: 'AT', CH: 'CH', PL: 'PL',
    SE: 'SE',
  };
  const wantPrefix = COUNTRY_PREFIX[country];
  if (!wantPrefix) {
    // No mapping → just keep the default
    return candidates.find(c => c.isDefault) || candidates[0];
  }

  const fetchPolicy = async (id: string): Promise<any | null> => {
    try {
      // Use the marketplace ID matching the seller's site for the policy fetch
      const marketplaceId = creds.siteId === '0' ? 'EBAY_US' :
                            creds.siteId === '2' ? 'EBAY_CA' :
                            creds.siteId === '15' ? 'EBAY_AU' :
                            creds.siteId === '77' ? 'EBAY_DE' :
                            creds.siteId === '71' ? 'EBAY_FR' :
                            creds.siteId === '101' ? 'EBAY_IT' :
                            creds.siteId === '186' ? 'EBAY_ES' : 'EBAY_GB';
      const res = await fetch(`https://api.ebay.com/sell/account/v1/fulfillment_policy/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${creds.authToken}`,
          'Accept': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const scored: Array<{ entry: any; score: number; reason: string }> = [];
  for (const c of candidates) {
    const policy = await fetchPolicy(c.id);
    if (!policy) {
      // Couldn't fetch — give it a neutral score so default still wins
      scored.push({ entry: c, score: c.isDefault ? 1 : 0, reason: 'unfetchable' });
      continue;
    }
    const services: any[] = [];
    for (const opt of (policy.shippingOptions || [])) {
      for (const svc of (opt.shippingServices || [])) {
        if (svc?.shippingServiceCode) services.push(svc.shippingServiceCode);
      }
    }
    if (services.length === 0) {
      scored.push({ entry: c, score: c.isDefault ? 1 : 0, reason: 'no-services' });
      continue;
    }
    const matching = services.filter(s => s.startsWith(`${wantPrefix}_`)).length;
    const nonMatching = services.length - matching;
    // Prefer policies where ALL services match the seller country.
    let score: number;
    if (matching === services.length) score = 100 + matching;
    else if (matching > 0) score = 50 + matching - nonMatching;
    else score = 0; // all non-matching → very likely to trigger error 240
    if (c.isDefault) score += 1; // tie-breaker toward seller's default

    // STORE-SAFETY: Avoid policies that offer Click & Collect / in-store
    // pickup. eBay surfaces these as a "Collection: Click & Collect — Select
    // store at checkout" line on the live listing, which the seller did not
    // ask us to enable. We never modify the seller's policies (the picker is
    // read-only) — but we DO refuse to pick a Click-&-Collect-enabled policy
    // unless it's literally the only option available. The penalty is large
    // enough to dominate every other tie-breaker.
    const isClickAndCollect =
      policy.pickupDropOff === true ||
      policy.eligibleForPickupDropOff === true ||
      services.some((s: any) => typeof s === 'string' && /^(UK|GB)_?CollectInStore|InStorePickup|ClickAndCollect/i.test(s));
    let reasonExtra = '';
    if (isClickAndCollect) {
      score -= 1000;
      reasonExtra = ' [penalised: Click&Collect]';
    }
    scored.push({ entry: c, score, reason: `matching=${matching}/${services.length}${reasonExtra}` });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  console.log(`[eBay Shipping] Picked policy "${best.entry.name}" (id=${best.entry.id}, score=${best.score}, ${best.reason}) for country=${country}. Candidates: ${scored.map(s => `${s.entry.name}:${s.score}`).join(', ')}`);
  return best.entry;
}

async function getSellerBusinessProfilesREST(creds: EbayCredentials): Promise<SellerProfiles | null> {
  // REST Sell-Account-API fallback. The Trading API GetUserPreferences call
  // only works once the seller has explicitly opted into business policies on
  // the legacy flow. eBay's modern Seller Hub onboarding creates policies via
  // the REST Sell account API and never sets the legacy SellerProfileOptedIn
  // flag — so we must check the REST endpoints too before we tell the user
  // they have no policies.
  const siteId = creds.siteId || '3';
  const marketplaceId = SITE_TO_MARKETPLACE[siteId] || 'EBAY_GB';
  const headers = {
    'Authorization': `Bearer ${creds.authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
  };

  try {
    const [shipRes, retRes, payRes] = await Promise.all([
      fetch(`https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, { headers }),
      fetch(`https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, { headers }),
      fetch(`https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, { headers }),
    ]);
    if (!shipRes.ok && !retRes.ok && !payRes.ok) {
      console.log(`[eBay REST Profiles] All three REST endpoints returned non-OK (ship=${shipRes.status}, ret=${retRes.status}, pay=${payRes.status}) — likely missing sell.account scope or token issue`);
      return null;
    }
    const shipJson: any = shipRes.ok ? await shipRes.json() : { fulfillmentPolicies: [] };
    const retJson: any = retRes.ok ? await retRes.json() : { returnPolicies: [] };
    const payJson: any = payRes.ok ? await payRes.json() : { paymentPolicies: [] };

    const shippingEntries = (shipJson.fulfillmentPolicies || []).map((p: any) => ({
      id: String(p.fulfillmentPolicyId), name: p.name || '', isDefault: false,
    }));
    const returnEntries = (retJson.returnPolicies || []).map((p: any) => ({
      id: String(p.returnPolicyId), name: p.name || '',
    }));
    const paymentEntries = (payJson.paymentPolicies || []).map((p: any) => ({
      id: String(p.paymentPolicyId), name: p.name || '',
    }));

    if (shippingEntries.length === 0 && returnEntries.length === 0 && paymentEntries.length === 0) {
      console.log(`[eBay REST Profiles] Seller truly has no policies on marketplace ${marketplaceId}`);
      return null;
    }

    const profiles: SellerProfiles = {};
    if (shippingEntries.length > 0) profiles.shippingProfileId = shippingEntries[0].id;
    if (returnEntries.length > 0) profiles.returnProfileId = returnEntries[0].id;
    if (paymentEntries.length > 0) profiles.paymentProfileId = paymentEntries[0].id;
    (profiles as any)._allShippingProfiles = shippingEntries;
    (profiles as any)._missing = {
      shipping: shippingEntries.length === 0,
      return: returnEntries.length === 0,
      payment: paymentEntries.length === 0,
    };
    console.log(`[eBay REST Profiles] Found via REST: shipping=${shippingEntries.length}, return=${returnEntries.length}, payment=${paymentEntries.length} on ${marketplaceId}`);
    return profiles;
  } catch (err: any) {
    console.error(`[eBay REST Profiles] Failed: ${err.message}`);
    return null;
  }
}

async function getSellerBusinessProfiles(creds: EbayCredentials): Promise<SellerProfiles | null> {
  return _cached(`profiles:${_tokenKey(creds.authToken)}:${creds.siteId || '3'}`, 15 * 60 * 1000, () => _getSellerBusinessProfilesUncached(creds));
}
async function _getSellerBusinessProfilesUncached(creds: EbayCredentials): Promise<SellerProfiles | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetUserPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ShowSellerProfilePreferences>true</ShowSellerProfilePreferences>
</GetUserPreferencesRequest>`;

  try {
    const response = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'GetUserPreferences'),
      body: xml,
    });

    const responseText = await response.text();
    console.log(`eBay GetUserPreferences HTTP status: ${response.status}, length: ${responseText.length}`);

    const optedInMatch = responseText.match(/<SellerProfileOptedIn>(\w+)<\/SellerProfileOptedIn>/);
    if (!optedInMatch || optedInMatch[1] !== 'true') {
      console.log('eBay seller NOT opted-in via Trading API — falling back to REST Sell-Account-API to look up policies directly');
      const restResult = await getSellerBusinessProfilesREST(creds);
      if (restResult) return restResult;
      console.log(`eBay GetUserPreferences raw response (first 600 chars): ${responseText.substring(0, 600)}`);
      return null;
    }

    console.log('eBay seller HAS opted into business policies');

    const profiles: SellerProfiles = {};
    const profileBlocks = [...responseText.matchAll(/<SupportedSellerProfile>([\s\S]*?)<\/SupportedSellerProfile>/g)];

    const byType: Record<string, { id: string; name: string; isDefault: boolean }[]> = {
      SHIPPING: [],
      RETURN_POLICY: [],
      PAYMENT: [],
    };

    for (const block of profileBlocks) {
      const content = block[1];
      const idMatch = content.match(/<ProfileID>(\d+)<\/ProfileID>/);
      const typeMatch = content.match(/<ProfileType>(\w+)<\/ProfileType>/);
      const nameMatch = content.match(/<ProfileName>([^<]*)<\/ProfileName>/);
      const defaultMatch = content.match(/<IsDefault>(\w+)<\/IsDefault>/);

      if (idMatch && typeMatch) {
        const profileType = typeMatch[1];
        const entry = {
          id: idMatch[1],
          name: nameMatch?.[1] || '',
          isDefault: defaultMatch?.[1] === 'true',
        };
        if (byType[profileType]) {
          byType[profileType].push(entry);
        }
      }
    }

    for (const type of ['RETURN_POLICY', 'PAYMENT'] as const) {
      const entries = byType[type];
      const defaultEntry = entries.find(e => e.isDefault);
      const selected = defaultEntry || entries[0];
      if (selected) {
        if (type === 'RETURN_POLICY') profiles.returnProfileId = selected.id;
        if (type === 'PAYMENT') profiles.paymentProfileId = selected.id;
      }
    }

    const shippingEntries = byType['SHIPPING'];
    const defaultShipping = shippingEntries.find(e => e.isDefault) || shippingEntries[0];
    if (defaultShipping) profiles.shippingProfileId = defaultShipping.id;
    (profiles as any)._allShippingProfiles = shippingEntries;
    (profiles as any)._missing = {
      shipping: !profiles.shippingProfileId,
      return: !profiles.returnProfileId,
      payment: !profiles.paymentProfileId,
    };

    console.log(`eBay seller profiles: shipping=${profiles.shippingProfileId} (of ${shippingEntries.length} available), return=${profiles.returnProfileId}, payment=${profiles.paymentProfileId}`);

    // If Trading API returned the opted-in flag but no profile IDs (eBay
    // sometimes returns an empty SupportedSellerProfile list when the user
    // has only created policies in the new Seller Hub), fall back to REST.
    if (!profiles.shippingProfileId || !profiles.returnProfileId) {
      console.log('Trading API returned incomplete profile set — supplementing with REST Sell-Account-API');
      const restResult = await getSellerBusinessProfilesREST(creds);
      if (restResult) {
        return {
          shippingProfileId: profiles.shippingProfileId || restResult.shippingProfileId,
          returnProfileId: profiles.returnProfileId || restResult.returnProfileId,
          paymentProfileId: profiles.paymentProfileId || restResult.paymentProfileId,
          _allShippingProfiles: (profiles as any)._allShippingProfiles?.length ? (profiles as any)._allShippingProfiles : (restResult as any)._allShippingProfiles,
          _missing: (restResult as any)._missing,
        } as any;
      }
    }
    return profiles;
  } catch (err: any) {
    console.error(`Failed to fetch eBay seller profiles via Trading API: ${err.message} — trying REST`);
    return await getSellerBusinessProfilesREST(creds);
  }
}

async function getSuggestedCategoryREST(creds: EbayCredentials, title: string): Promise<string | null> {
  const siteId = creds.siteId || '3';
  const query = encodeURIComponent(title.substring(0, 200));

  try {
    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/${siteId}/get_category_suggestions?q=${query}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${creds.authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`eBay Taxonomy API HTTP ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const suggestions = data?.categorySuggestions;

    if (suggestions && suggestions.length > 0) {
      const categoryId = suggestions[0]?.category?.categoryId;
      const categoryName = suggestions[0]?.category?.categoryName;
      console.log(`eBay Taxonomy API suggested category: ${categoryId} (${categoryName})`);
      return categoryId || null;
    }

    console.log('eBay Taxonomy API: no suggestions returned');
    return null;
  } catch (err: any) {
    console.error(`eBay Taxonomy API error: ${err.message}`);
    return null;
  }
}

async function getSuggestedCategoryTrading(creds: EbayCredentials, title: string): Promise<string | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetSuggestedCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Query>${escapeXml(title.substring(0, 350))}</Query>
</GetSuggestedCategoriesRequest>`;

  try {
    const response = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'GetSuggestedCategories'),
      body: xml,
    });

    const responseText = await response.text();
    console.log(`eBay GetSuggestedCategories Trading API HTTP status: ${response.status}`);

    if (response.status >= 500) return null;

    const categoryBlocks = [...responseText.matchAll(/<SuggestedCategory>([\s\S]*?)<\/SuggestedCategory>/g)];

    for (const block of categoryBlocks) {
      const content = block[1];
      const catIdMatch = content.match(/<CategoryID>(\d+)<\/CategoryID>/);
      const leafMatch = content.match(/<LeafCategory>(\w+)<\/LeafCategory>/);
      if (catIdMatch && leafMatch && leafMatch[1] === 'true') {
        console.log(`eBay Trading API suggested leaf category: ${catIdMatch[1]}`);
        return catIdMatch[1];
      }
    }

    return null;
  } catch (err: any) {
    console.error(`eBay Trading API GetSuggestedCategories error: ${err.message}`);
    return null;
  }
}

function getKeywordCategory(title: string, siteId: string): string {
  const t = title.toLowerCase();

  const UK_CATEGORIES: [RegExp, string][] = [
    [/pyjama|pajama|sleepwear|nightwear|nightgown|loungewear|pjs/i, '11514'],
    [/dress\b|gown|frock/i, '63861'],
    [/t-?shirt|tee\b|top\b|blouse|shirt/i, '53159'],
    [/trouser|pant|jean|legging|short\b/i, '11555'],
    [/jacket|coat|hoodie|sweater|cardigan|jumper/i, '63862'],
    [/shoe|trainer|sneaker|boot|sandal|heel/i, '63889'],
    [/bag|handbag|purse|backpack|rucksack/i, '169291'],
    [/watch\b/i, '31387'],
    [/phone|mobile|smartphone|iphone|samsung|case/i, '9394'],
    [/laptop|notebook|computer|tablet|ipad/i, '177'],
    [/headphone|earphone|earbud|airpod|speaker/i, '112529'],
    [/camera|lens|tripod/i, '31388'],
    [/battery|charger|power bank|adapter/i, '48446'],
    [/drill|saw|tool|wrench|screwdriver|dewalt|makita|bosch/i, '631'],
    [/garden|lawn|mower|outdoor|patio/i, '159912'],
    [/kitchen|cookware|bakeware|pan\b|pot\b|utensil/i, '20625'],
    [/toy|game|puzzle|lego|doll|action figure/i, '220'],
    [/book\b|novel|textbook/i, '261186'],
    [/beauty|makeup|cosmetic|skincare|cream|serum/i, '11700'],
    [/hair\b.*(?:dryer|straighten|curler|clip|extension)/i, '11854'],
    [/vitamin|supplement|protein|health/i, '180959'],
    [/pet|dog|cat|fish|bird/i, '1281'],
    [/car\b|auto|vehicle|motor/i, '6028'],
    [/baby|infant|toddler|newborn|nursery/i, '3082'],
    [/bed|mattress|pillow|duvet|blanket|sheet/i, '20444'],
    [/lamp|light|bulb|chandelier/i, '20697'],
    [/tv\b|television|monitor|screen/i, '11071'],
    [/printer|ink|toner|scanner/i, '1245'],
    [/fitness|gym|exercise|yoga|dumbbell|weight/i, '15273'],
    [/cycle|bike|bicycle/i, '177831'],
    [/jewel|necklace|bracelet|ring\b|earring/i, '10968'],
    [/hat|cap|scarf|glove|belt|accessori/i, '4250'],
    [/swim|bikini|swimsuit|swimwear/i, '63867'],
    [/underwear|bra\b|lingerie|sock|boxer/i, '11510'],
    [/skin care|moisturis|cleanser|face.*wash/i, '11700'],
  ];

  const US_CATEGORIES: [RegExp, string][] = [
    [/pyjama|pajama|sleepwear|nightwear|loungewear|pjs/i, '11514'],
    [/dress\b|gown|frock/i, '63861'],
    [/t-?shirt|tee\b|top\b|blouse|shirt/i, '15687'],
    [/trouser|pant|jean|legging|short\b/i, '11555'],
    [/jacket|coat|hoodie|sweater/i, '63862'],
    [/shoe|trainer|sneaker|boot|sandal/i, '63889'],
    [/phone|mobile|smartphone|iphone|samsung|case/i, '9394'],
    [/laptop|computer|tablet/i, '177'],
    [/drill|saw|tool|dewalt|makita/i, '631'],
    [/toy|game|puzzle|lego/i, '220'],
    [/beauty|makeup|cosmetic|skincare/i, '11700'],
    [/kitchen|cookware/i, '20625'],
    [/pet|dog|cat/i, '1281'],
    [/baby|infant|toddler/i, '3082'],
    [/fitness|gym|exercise/i, '15273'],
    [/jewel|necklace|bracelet|ring\b|earring/i, '10968'],
    [/watch\b/i, '31387'],
    [/battery|charger|power bank/i, '48446'],
    [/garden|lawn|outdoor/i, '159912'],
    [/car\b|auto|vehicle/i, '6028'],
  ];

  const categories = (siteId === '0' || siteId === '2') ? US_CATEGORIES : UK_CATEGORIES;

  for (const [pattern, catId] of categories) {
    if (pattern.test(t)) {
      console.log(`eBay keyword category match: "${pattern.source}" -> ${catId}`);
      return catId;
    }
  }

  return siteId === '3' ? '20349' : '99';
}

async function getRequiredItemSpecifics(creds: EbayCredentials, categoryId: string): Promise<string[]> {
  return _cached(`reqAspects:${creds.siteId || '3'}:${categoryId}`, 24 * 60 * 60 * 1000, () => _getRequiredItemSpecificsUncached(creds, categoryId));
}
async function _getRequiredItemSpecificsUncached(creds: EbayCredentials, categoryId: string): Promise<string[]> {
  const siteId = creds.siteId || '3';

  try {
    const response = await fetch(
      `https://api.ebay.com/commerce/taxonomy/v1/category_tree/${siteId}/get_item_aspects_for_category?category_id=${categoryId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${creds.authToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`eBay getItemAspects HTTP ${response.status}`);
      return ['Brand'];
    }

    const data = await response.json() as any;
    const aspects = data?.aspects || [];
    const required: string[] = [];

    for (const aspect of aspects) {
      const constraint = aspect?.aspectConstraint;
      if (constraint?.aspectRequired || constraint?.aspectUsage === 'RECOMMENDED') {
        if (constraint?.aspectRequired) {
          required.push(aspect.localizedAspectName);
        }
      }
    }

    console.log(`eBay required item specifics for category ${categoryId}: ${required.join(', ')}`);
    return required.length > 0 ? required : ['Brand'];
  } catch (err: any) {
    console.error(`Failed to get item aspects: ${err.message}`);
    return ['Brand'];
  }
}

async function getValidConditionId(creds: EbayCredentials, categoryId: string): Promise<string> {
  return _cached(`condId:${creds.siteId || '3'}:${categoryId}`, 24 * 60 * 60 * 1000, () => _getValidConditionIdUncached(creds, categoryId));
}
// eBay is decommissioning the legacy Trading API GetCategoryFeatures call on
// 2026-06-04. We now read valid item conditions from the modern Sell Metadata
// API (getItemConditionPolicies), which uses the same OAuth token + marketplace
// headers as our other REST calls. See:
// https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getItemConditionPolicies
async function _getValidConditionIdUncached(creds: EbayCredentials, categoryId: string): Promise<string> {
  const siteId = creds.siteId || '3';
  const marketplaceId = SITE_TO_MARKETPLACE[siteId] || 'EBAY_GB';

  try {
    const response = await fetch(
      `https://api.ebay.com/sell/metadata/v1/marketplace/${marketplaceId}/get_item_condition_policies?filter=categoryIds:{${categoryId}}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${creds.authToken}`,
          'Accept': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      }
    );

    console.log(`eBay getItemConditionPolicies HTTP ${response.status} for category ${categoryId} on ${marketplaceId}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.log(`eBay getItemConditionPolicies failed for category ${categoryId}: ${errText.slice(0, 200) || 'unknown error'}, defaulting to ConditionID 1000`);
      return '1000';
    }

    const data = await response.json() as any;
    const policies = Array.isArray(data?.itemConditionPolicies) ? data.itemConditionPolicies : [];
    const policy = policies.find((p: any) => String(p?.categoryId) === String(categoryId)) || policies[0];
    const conditions = Array.isArray(policy?.itemConditions) ? policy.itemConditions : [];
    const validIds: string[] = conditions
      .map((c: any) => (c?.conditionId != null ? String(c.conditionId) : null))
      .filter((id: string | null): id is string => !!id);

    console.log(`eBay valid condition IDs for category ${categoryId}: ${validIds.join(', ') || 'none found'}`);

    if (validIds.length === 0) return '1000';

    const preferred = ['1000', '1500', '1750', '3000'];
    for (const id of preferred) {
      if (validIds.includes(id)) {
        console.log(`eBay using condition ID ${id} for category ${categoryId}`);
        return id;
      }
    }

    console.log(`eBay using first available condition ID ${validIds[0]} for category ${categoryId}`);
    return validIds[0];
  } catch (err: any) {
    console.error(`Failed to get valid conditions for category ${categoryId}: ${err.message}`);
    return '1000';
  }
}

function extractBrandFromTitle(title: string): string {
  const knownBrands = [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance',
    'Samsung', 'Apple', 'Sony', 'LG', 'Huawei', 'Xiaomi', 'OnePlus', 'Google', 'Motorola',
    'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Toshiba',
    'Dewalt', 'DeWalt', 'Makita', 'Bosch', 'Milwaukee', 'Ryobi', 'Black & Decker', 'Stanley',
    'Dyson', 'Philips', 'Panasonic', 'Braun', 'Kenwood', 'Breville',
    'Lego', 'Hasbro', 'Mattel', 'Fisher-Price', 'Barbie',
    'Ekouaer', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren', 'Zara', 'H&M',
    'Gucci', 'Prada', 'Louis Vuitton', 'Chanel', 'Versace', 'Burberry',
    'JBL', 'Bose', 'Sennheiser', 'Beats', 'Anker', 'Logitech',
    'Canon', 'Nikon', 'GoPro', 'Fujifilm',
    'Garmin', 'Fitbit', 'Casio', 'Seiko', 'Fossil', 'Timex',
    'Oral-B', 'Gillette', 'Neutrogena', 'Olay', "L'Oreal", 'Nivea',
    'Duracell', 'Energizer', 'Varta',
    'North Face', 'Columbia', 'Patagonia', 'Superdry',
    'Ikea', 'KitchenAid', 'Tefal', 'Russell Hobbs', 'Ninja',
  ];

  const titleLower = title.toLowerCase();
  for (const brand of knownBrands) {
    if (titleLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  const firstWord = title.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 2 && firstWord.length <= 20 && /^[A-Z]/.test(firstWord)) {
    return firstWord;
  }

  return 'Unbranded';
}

function generateItemSpecificsXml(requiredSpecifics: string[], product: MarketplaceProduct, excludeAxes: string[] = []): string {
  // eBay rejects multi-SKU listings (error 21916626) when the same name appears
  // in both <ItemSpecifics> and <VariationSpecificsSet>. Filter out any axis
  // used by the variations from the required-specifics list.
  if (excludeAxes.length > 0) {
    const excludeSet = new Set(excludeAxes.map(a => a.trim().toLowerCase()));
    requiredSpecifics = requiredSpecifics.filter(s => !excludeSet.has(s.trim().toLowerCase()));
  }
  const title = product.title;
  const description = product.description || '';
  const fullText = `${title} ${description}`.toLowerCase();

  const brand = (product.brand && product.brand.trim()) || extractBrandFromTitle(title);

  // AI-saved item specifics live in product.attributes.itemSpecifics as a
  // case-insensitive {Name -> Value} map. Prefer these over heuristics so the
  // values the user reviewed and approved are what actually appear on eBay.
  const savedSpecifics: Record<string, string> = {};
  const savedRaw = (product.attributes as any)?.itemSpecifics;
  if (savedRaw && typeof savedRaw === 'object' && !Array.isArray(savedRaw)) {
    for (const [k, v] of Object.entries(savedRaw)) {
      if (typeof v === 'string' && v.trim()) savedSpecifics[k.trim().toLowerCase()] = v.trim();
      else if (typeof v === 'number') savedSpecifics[k.trim().toLowerCase()] = String(v);
    }
  }
  // Common eBay aspect aliases — eBay sometimes requires "Manufacturer Part Number"
  // while the AI saves it as "MPN", or "Color" vs British "Colour". Normalise both
  // sides so a saved value still wins over the heuristic fallback.
  const ALIAS_GROUPS: string[][] = [
    ['mpn', 'manufacturer part number', 'part number'],
    ['colour', 'color', 'main colour', 'main color'],
    ['country/region of manufacture', 'country of manufacture', 'country of origin', 'country/region of origin'],
    ['department', 'gender', 'target audience'],
    ['material', 'main material', 'band material'],
    ['size', 'size type'],
    ['compatible operating system', 'operating system', 'compatible os'],
    ['features', 'key features'],
  ];
  const aliasLookup: Record<string, string[]> = {};
  for (const group of ALIAS_GROUPS) for (const name of group) aliasLookup[name] = group;
  const pickSaved = (name: string): string | null => {
    const key = name.trim().toLowerCase();
    if (savedSpecifics[key]) return savedSpecifics[key];
    const group = aliasLookup[key];
    if (group) {
      for (const alt of group) {
        if (savedSpecifics[alt]) return savedSpecifics[alt];
      }
    }
    return null;
  };

  const specificsMap: Record<string, string> = {};

  for (const specific of requiredSpecifics) {
    const key = specific.toLowerCase();

    const aiVal = pickSaved(specific);
    if (aiVal && aiVal.toLowerCase() !== 'does not apply') {
      specificsMap[specific] = aiVal;
      continue;
    }

    if (key === 'brand') {
      specificsMap[specific] = brand;
    } else if (key === 'mpn' || key === 'manufacturer part number') {
      specificsMap[specific] = product.sku || 'Does Not Apply';
    } else if (key === 'model') {
      const modelMatch = fullText.match(/model[:\s]+([a-z0-9][\w\s-]{1,30})/i);
      specificsMap[specific] = modelMatch ? modelMatch[1].trim() : 'Does Not Apply';
    } else if (key === 'type') {
      specificsMap[specific] = extractFromContext(fullText, ['set', 'pair', 'kit', 'single', 'bundle', 'pack']) || 'Does Not Apply';
    } else if (key === 'colour' || key === 'color') {
      specificsMap[specific] = extractFromContext(fullText, [
        'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange',
        'grey', 'gray', 'brown', 'beige', 'navy', 'gold', 'silver', 'multicoloured', 'cream',
      ]) || 'Multicoloured';
    } else if (key === 'size') {
      specificsMap[specific] = extractFromContext(fullText, [
        'xxs', 'xs', 'small', 'medium', 'large', 'xl', 'xxl', 'xxxl',
        's', 'm', 'l', 'one size', 'free size',
      ]) || 'One Size';
    } else if (key === 'material' || key === 'band material' || key === 'main material') {
      specificsMap[specific] = extractFromContext(fullText, [
        'cotton', 'polyester', 'nylon', 'silk', 'satin', 'leather', 'rubber', 'silicone',
        'stainless steel', 'plastic', 'wood', 'metal', 'canvas', 'denim', 'linen',
        'spandex', 'elastane', 'lycra', 'fleece', 'wool', 'cashmere', 'velvet',
      ]) || 'Does Not Apply';
    } else if (key === 'compatible operating system') {
      specificsMap[specific] = extractFromContext(fullText, [
        'ios', 'android', 'windows', 'macos', 'linux', 'wear os', 'tizen',
      ]) || 'Universal';
    } else if (key === 'department' || key === 'gender') {
      specificsMap[specific] = extractFromContext(fullText, [
        'women', "women's", 'men', "men's", 'boys', 'girls', 'unisex', 'kids', 'baby',
      ]) || 'Unisex';
    } else if (key === 'case size') {
      const sizeMatch = fullText.match(/(\d{2,3})\s*mm/);
      specificsMap[specific] = sizeMatch ? `${sizeMatch[1]} mm` : 'Does Not Apply';
    } else if (key === 'style') {
      specificsMap[specific] = 'Casual';
    } else if (key === 'pattern') {
      specificsMap[specific] = extractFromContext(fullText, [
        'solid', 'striped', 'plaid', 'floral', 'geometric', 'animal print', 'checkered', 'polka dot',
      ]) || 'Solid';
    } else if (key === 'features') {
      specificsMap[specific] = 'N/A';
    } else if (key === 'connectivity') {
      specificsMap[specific] = extractFromContext(fullText, [
        'bluetooth', 'wifi', 'wi-fi', 'usb', 'nfc', 'gps', 'cellular',
      ]) || 'Does Not Apply';
    } else if (key === 'screen size') {
      const screenMatch = fullText.match(/(\d+\.?\d*)\s*(?:inch|"|'')/);
      specificsMap[specific] = screenMatch ? `${screenMatch[1]} in` : 'Does Not Apply';
    } else {
      specificsMap[specific] = 'Does Not Apply';
    }
  }

  if (!specificsMap['Brand'] && !specificsMap['brand']) {
    specificsMap['Brand'] = brand;
  }
  if (!specificsMap['MPN'] && !specificsMap['Manufacturer Part Number']) {
    specificsMap['MPN'] = product.sku || 'Does Not Apply';
  }

  const xmlParts = Object.entries(specificsMap).map(([name, value]) =>
    `<NameValueList><Name>${escapeXml(name)}</Name><Value>${escapeXml(value)}</Value></NameValueList>`
  );

  return `<ItemSpecifics>\n      ${xmlParts.join('\n      ')}\n    </ItemSpecifics>`;
}

function extractFromContext(text: string, options: string[]): string | null {
  for (const option of options) {
    if (text.includes(option.toLowerCase())) {
      return option.charAt(0).toUpperCase() + option.slice(1);
    }
  }
  return null;
}

async function getSuggestedCategory(creds: EbayCredentials, title: string): Promise<string> {
  // Cache by site + a short title fingerprint — same products get reposted often.
  const fp = (title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
  return _cached(`suggCat:${creds.siteId || '3'}:${fp}`, 6 * 60 * 60 * 1000, () => _getSuggestedCategoryUncached(creds, title));
}
async function _getSuggestedCategoryUncached(creds: EbayCredentials, title: string): Promise<string> {
  const restCategory = await getSuggestedCategoryREST(creds, title);
  if (restCategory) return restCategory;

  const tradingCategory = await getSuggestedCategoryTrading(creds, title);
  if (tradingCategory) return tradingCategory;

  const keywordCategory = getKeywordCategory(title, creds.siteId || '3');
  console.log(`eBay using keyword-based fallback category: ${keywordCategory}`);
  return keywordCategory;
}

export const ebayProvider: MarketplaceProvider = {
  validateCredentials(credentials: any): { valid: boolean; error?: string } {
    const creds = getFullCredentials(credentials);
    if (!creds.authToken) return { valid: false, error: "eBay Auth Token is required. Please reconnect your eBay account." };
    if (!creds.appId) return { valid: false, error: "eBay App ID is not configured. Please contact support." };
    if (!creds.certId) return { valid: false, error: "eBay Cert ID is not configured. Please contact support." };
    if (!creds.devId) return { valid: false, error: "eBay Dev ID is not configured. Please contact support." };
    return { valid: true };
  },

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    const creds = getFullCredentials(credentials);
    const siteId = creds.siteId || '3';
    
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
</GeteBayOfficialTimeRequest>`;

    try {
      const response = await fetch('https://api.ebay.com/ws/api.dll', {
        method: 'POST',
        headers: makeEbayHeaders(creds, 'GeteBayOfficialTime'),
        body: xml,
      });

      const responseText = await response.text();
      console.log(`eBay testConnection HTTP status: ${response.status}, response (first 500 chars): ${responseText.substring(0, 500)}`);

      if (response.status >= 500) {
        const siteConfig = SITE_CONFIG[siteId] || SITE_CONFIG['3'];
        return { success: true, status: 'connected', message: `Connected to eBay ${siteConfig.domain} (eBay API temporarily unavailable, but your credentials are valid)` };
      }

      const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
      
      if (ackMatch && (ackMatch[1] === 'Success' || ackMatch[1] === 'Warning')) {
        const siteConfig = SITE_CONFIG[siteId] || SITE_CONFIG['3'];
        return { success: true, status: 'connected', message: `Connected to eBay ${siteConfig.domain} successfully` };
      }

      const errorCodeMatch = responseText.match(/<ErrorCode>(\d+)<\/ErrorCode>/);
      const errorMatch = responseText.match(/<LongMessage>([^<]+)<\/LongMessage>/) || responseText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
      const errorMsg = errorMatch?.[1] || 'eBay authentication failed.';
      const errorCode = errorCodeMatch?.[1] || 'unknown';
      console.log(`eBay testConnection error: code=${errorCode}, message=${errorMsg}`);
      
      if (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('expire')) {
        return { success: false, status: 'invalid', message: `${errorMsg} Your eBay token may have expired — try reconnecting your eBay account.` };
      }
      return { success: false, status: 'invalid', message: errorMsg };
    } catch (err: any) {
      // Network/transport-level failure reaching eBay (DNS hiccup, connection
      // reset, socket timeout, fetch failed, etc.). The OAuth tokens are still
      // valid — they just couldn't be verified this instant. Marking the store
      // as "invalid" here pushes legitimate users into a pointless reconnect
      // loop and breaks downstream features that look at store.status. So we
      // mirror the same forgiving behaviour the 5xx branch already uses: keep
      // the store connected and surface a soft note explaining the verification
      // was skipped this round.
      const siteConfig = SITE_CONFIG[siteId] || SITE_CONFIG['3'];
      const rawMessage = err?.message || String(err);
      const code = err?.code || err?.cause?.code;
      const isTransient =
        rawMessage.toLowerCase().includes('fetch failed') ||
        rawMessage.toLowerCase().includes('network') ||
        rawMessage.toLowerCase().includes('socket') ||
        rawMessage.toLowerCase().includes('timed out') ||
        rawMessage.toLowerCase().includes('timeout') ||
        rawMessage.toLowerCase().includes('econnreset') ||
        rawMessage.toLowerCase().includes('econnrefused') ||
        rawMessage.toLowerCase().includes('etimedout') ||
        rawMessage.toLowerCase().includes('enotfound') ||
        rawMessage.toLowerCase().includes('eai_again') ||
        rawMessage.toLowerCase().includes('aborterror') ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        code === 'UND_ERR_SOCKET' ||
        code === 'UND_ERR_CONNECT_TIMEOUT';

      if (isTransient) {
        console.warn(`eBay testConnection transient network failure (${code || 'no-code'}): ${rawMessage} — treating store as still connected.`);
        return {
          success: true,
          status: 'connected',
          message: `Connected to eBay ${siteConfig.domain} (couldn't reach eBay just now to double-check, but your credentials are valid).`,
        };
      }

      console.error(`eBay testConnection unexpected error: ${rawMessage}`);
      return { success: false, status: 'invalid', message: `Failed to connect to eBay: ${rawMessage}` };
    }
  },

  async publishProduct(credentials: any, product: MarketplaceProduct): Promise<PublishResult> {
    const creds = getFullCredentials(credentials);
    const siteId = creds.siteId || '3';
    const siteConfig = SITE_CONFIG[siteId] || SITE_CONFIG['3'];

    // ------------------------------------------------------------------
    // Pre-flatten variations into the simple { type, value, image, ... }
    // shape BEFORE doing any image conversion. The importer / browser
    // extension hands us several different shapes — most importantly the
    // grouped form `{ name: "Colour", values: [{ value: "Blue", image: "data:..." }, ...] }`
    // — and per-variation images live INSIDE those nested items. If we run
    // EPS conversion against `product.variations[i].image` first (as we used
    // to), grouped-shape variations contribute zero images to the upload
    // batch and the variation-picture block on the listing ends up empty.
    // ------------------------------------------------------------------
    const flattenVariationsForPublish = (raw: any[]): Array<{ type: string; value: string; price?: string; quantity?: number; available: boolean; image?: string; images?: string[] }> => {
      const siteIdForNames = creds.siteId || '3';
      const usesUkSpelling = siteIdForNames === '3' || siteIdForNames === '15' || siteIdForNames === '2';
      const normaliseTypeName = (rawName: string): string => {
        const trimmed = String(rawName).trim();
        if (!trimmed) return '';
        const lower = trimmed.toLowerCase();
        if (lower === 'colour' || lower === 'color') return usesUkSpelling ? 'Colour' : 'Color';
        if (lower === 'size') return 'Size';
        if (lower === 'material') return 'Material';
        if (lower === 'style') return 'Style';
        if (lower === 'pattern') return 'Pattern';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      };
      const out: Array<{ type: string; value: string; price?: string; quantity?: number; available: boolean; image?: string; images?: string[] }> = [];
      const pickImages = (obj: any): string[] | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;
        if (Array.isArray(obj.images)) {
          const arr = obj.images.filter((u: any): u is string => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:')));
          if (arr.length > 0) return arr;
        }
        const single = obj.image || obj.imageUrl || obj.picture || obj.img;
        if (typeof single === 'string' && (single.startsWith('http') || single.startsWith('data:'))) return [single];
        return undefined;
      };
      for (const r of (raw || [])) {
        if (!r || typeof r !== 'object') continue;
        const typeRaw = r.type || r.name || r.optionName || r.attribute || r.axis;
        if (!typeRaw) continue;
        const typeName = normaliseTypeName(String(typeRaw));
        if (!typeName) continue;
        if (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') {
          const imgs = pickImages(r);
          out.push({
            type: typeName,
            value: String(r.value).trim(),
            price: r.price !== undefined ? String(r.price) : undefined,
            quantity: typeof r.quantity === 'number' ? r.quantity : (r.quantity !== undefined && !isNaN(parseInt(r.quantity)) ? parseInt(r.quantity) : undefined),
            available: r.available !== false,
            image: imgs?.[0],
            images: imgs,
          });
          continue;
        }
        const valuesArr: any[] | null = Array.isArray(r.values) ? r.values : (Array.isArray(r.options) ? r.options : null);
        if (valuesArr && valuesArr.length > 0) {
          for (const item of valuesArr) {
            if (item === null || item === undefined) continue;
            if (typeof item === 'string' || typeof item === 'number') {
              const valueStr = String(item).trim();
              if (!valueStr) continue;
              out.push({ type: typeName, value: valueStr, available: true });
            } else if (typeof item === 'object') {
              const valueRaw = item.value ?? item.name ?? item.label ?? item.option;
              if (valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') continue;
              const imgs = pickImages(item);
              out.push({
                type: typeName,
                value: String(valueRaw).trim(),
                price: item.price !== undefined ? String(item.price) : undefined,
                quantity: typeof item.quantity === 'number' ? item.quantity : (item.quantity !== undefined && !isNaN(parseInt(item.quantity)) ? parseInt(item.quantity) : undefined),
                available: item.available !== false,
                image: imgs?.[0],
                images: imgs,
              });
            }
          }
        }
      }
      return out;
    };

    if (Array.isArray(product.variations) && product.variations.length > 0) {
      const flat = flattenVariationsForPublish(product.variations as any[]);
      if (flat.length > 0) {
        product.variations = flat as any;
        const withImg = flat.filter(v => !!v.image).length;
        console.log(`[eBay Variations] Flattened ${flat.length} variation entrie(s) (${withImg} with images) — types: ${Array.from(new Set(flat.map(v => v.type))).join(', ')}`);
      }
    }

    // Convert all product images (and any per-variation images) to eBay-hosted EPS URLs
    // so they meet eBay's format/size/HTTPS requirements automatically.
    try {
      const isAcceptable = (s: any) => typeof s === 'string' && (s.startsWith('http') || s.startsWith('data:'));
      const originalImages = Array.isArray(product.images) ? product.images.filter(isAcceptable) : [];
      const variationImages: string[] = Array.isArray(product.variations)
        ? product.variations.flatMap((v: any) => {
            const out: string[] = [];
            if (Array.isArray(v?.images)) for (const u of v.images) if (isAcceptable(u)) out.push(u);
            if (isAcceptable(v?.image)) out.push(v.image);
            return out;
          })
        : [];
      // Cap the upload batch at 24 (eBay's per-listing picture cap) so we
      // don't waste API time uploading images we won't be able to attach.
      const uniqueUrls = Array.from(new Set([...originalImages, ...variationImages])).slice(0, 24);
      if (uniqueUrls.length > 0) {
        console.log(`[eBay EPS] Converting ${uniqueUrls.length} image(s) to eBay-hosted format before publish (gallery: ${originalImages.length}, variation: ${variationImages.length})...`);
        const converted = await convertImagesForEbay(creds, uniqueUrls);
        const map = new Map<string, string>();
        const failed: string[] = [];
        uniqueUrls.forEach((orig, i) => {
          const c = converted[i];
          if (typeof c === 'string' && c.startsWith('http')) {
            map.set(orig, c);
          } else if (orig.startsWith('http')) {
            // EPS upload failed but we still have a public URL — let eBay try
            // to fetch the original itself (forced HTTPS). Better than dropping
            // the picture entirely.
            map.set(orig, orig.replace(/^http:\/\//i, 'https://'));
          } else {
            // Data URLs that fail EPS upload truly cannot be saved — eBay can't
            // fetch them. Log the loss loudly so it's visible.
            failed.push(orig.slice(0, 60) + '…');
          }
        });
        const remap = (u: string): string | undefined => {
          const m = map.get(u);
          return m && m.startsWith('http') ? m : undefined;
        };
        const hostedGallery = originalImages.map(remap).filter((u): u is string => !!u);
        let hostedVariations: string[] = [];
        if (Array.isArray(product.variations)) {
          product.variations = product.variations.map((v: any) => {
            const allImgs: string[] = [];
            if (Array.isArray(v?.images)) for (const u of v.images) if (typeof u === 'string') allImgs.push(u);
            if (typeof v?.image === 'string' && !allImgs.includes(v.image)) allImgs.unshift(v.image);
            const finalImages = Array.from(new Set(allImgs.map(remap).filter((u): u is string => !!u)));
            for (const u of finalImages) if (!hostedVariations.includes(u)) hostedVariations.push(u);
            return { ...v, image: finalImages[0], images: finalImages.length > 0 ? finalImages : undefined };
          });
        }
        // CRITICAL: eBay requires every URL used in <VariationSpecificPictureSet>
        // to ALSO be present in <PictureDetails>. Without this, eBay silently
        // drops the variation pictures and the gallery never swaps when the
        // buyer changes colour. Merge variation pics into the main gallery.
        const merged: string[] = [];
        for (const u of hostedGallery) if (!merged.includes(u)) merged.push(u);
        for (const u of hostedVariations) if (!merged.includes(u)) merged.push(u);
        product.images = merged.slice(0, 24);
        const hostedCount = converted.filter((u: string) => typeof u === 'string' && u.includes('ebayimg.com')).length;
        console.log(`[eBay EPS] Image conversion complete (${hostedCount}/${uniqueUrls.length} hosted on eBay, gallery final: ${product.images.length}, variation pics merged: ${hostedVariations.length}).`);
        if (failed.length > 0) {
          console.warn(`[eBay EPS] ${failed.length} data-URL image(s) failed to upload to eBay Picture Services and had to be dropped: ${failed.join(', ')}`);
        }
      }
    } catch (err: any) {
      console.warn(`[eBay EPS] Image conversion failed, falling back to original URLs: ${err.message}`);
    }

    const [sellerProfiles, categoryId, registrationLocation, inventoryLocation] = await Promise.all([
      getSellerBusinessProfiles(creds),
      product.categoryId ? Promise.resolve(product.categoryId) : getSuggestedCategory(creds, product.title),
      getSellerLocation(creds),
      getSellerInventoryLocation(creds),
    ]);
    // Prefer the seller's configured INVENTORY ship-from location — that's
    // what eBay validates Item.Location against vs the shipping policy
    // (eBay error 240). Fall back to the registration address, then the site
    // default.
    const sellerLocation = inventoryLocation || registrationLocation;
    const itemCountry = sellerLocation?.country || siteConfig.country;
    const itemLocation = sellerLocation?.location || siteConfig.location;
    const itemPostalCode = sellerLocation?.postalCode;
    if (inventoryLocation && registrationLocation && inventoryLocation.country !== registrationLocation.country) {
      console.log(`[eBay] Inventory location country (${inventoryLocation.country}) differs from registration country (${registrationLocation.country}) — using inventory location for Item.Location to match shipping policy.`);
    }

    // Pick the shipping policy whose services match the seller's country —
    // protects against eBay error 240 when the seller has multiple shipping
    // policies and their default one contains non-domestic postage services.
    if (sellerProfiles && (sellerProfiles as any)._allShippingProfiles && itemCountry) {
      const allShipping = (sellerProfiles as any)._allShippingProfiles as Array<{ id: string; name: string; isDefault: boolean }>;
      if (allShipping.length > 1) {
        const picked = await pickShippingPolicyMatchingCountry(creds, allShipping, itemCountry);
        if (picked && picked.id !== sellerProfiles.shippingProfileId) {
          console.log(`[eBay Shipping] Overriding default shipping policy ${sellerProfiles.shippingProfileId} → ${picked.id} ("${picked.name}") to match Item.Country=${itemCountry}.`);
          sellerProfiles.shippingProfileId = picked.id;
        }
      }
    }

    const [requiredSpecifics, conditionId] = await Promise.all([
      getRequiredItemSpecifics(creds, categoryId),
      getValidConditionId(creds, categoryId),
    ]);
    const variationAxisNames = Array.isArray(product.variations)
      ? Array.from(new Set((product.variations as any[])
          .map((v: any) => (v?.type || v?.name || '').toString().trim())
          .filter(Boolean)))
      : [];
    const itemSpecificsXml = generateItemSpecificsXml(requiredSpecifics, product, variationAxisNames);

    const hasAllProfiles = sellerProfiles && sellerProfiles.shippingProfileId && sellerProfiles.returnProfileId;
    const useBusinessPolicies = !!hasAllProfiles;

    if (!useBusinessPolicies) {
      const missing = (sellerProfiles as any)?._missing as { shipping: boolean; return: boolean; payment: boolean } | undefined;
      const missingList: string[] = [];
      if (!sellerProfiles) {
        missingList.push('Shipping', 'Return', 'Payment');
      } else {
        if (!sellerProfiles.shippingProfileId || missing?.shipping) missingList.push('Shipping');
        if (!sellerProfiles.returnProfileId || missing?.return) missingList.push('Return');
        if (!sellerProfiles.paymentProfileId || missing?.payment) missingList.push('Payment');
      }
      const which = missingList.length === 0 ? 'Shipping and Return' : missingList.join(' + ');
      console.log(`eBay publish BLOCKED: missing business policies (${which}). sellerProfiles=${JSON.stringify(sellerProfiles)}`);
      const friendly = `Your eBay account is missing the following business polic${missingList.length === 1 ? 'y' : 'ies'}: ${which}. ` +
        `Please open eBay → My eBay → Account → Business Policies (or Seller Hub → Settings → Business Policies), create the missing polic${missingList.length === 1 ? 'y' : 'ies'} (you only need one of each), then try publishing again. ` +
        `If you DO already have all three policies set up, your eBay token may not include the "Account" permission — disconnect and reconnect "${(creds as any).storeName || 'your eBay store'}" from the Stores page so we can request the updated permissions.`;
      return { success: false, externalId: '', error: friendly };
    }

    console.log(`eBay publish: category=${categoryId}, conditionId=${conditionId}, useBusinessPolicies=${useBusinessPolicies}, profiles={shipping:${sellerProfiles?.shippingProfileId || 'none'}, return:${sellerProfiles?.returnProfileId || 'none'}, payment:${sellerProfiles?.paymentProfileId || 'none'}}, requiredSpecifics=${requiredSpecifics.join(', ')}`);

    const buildPolicyXml = (): { xml: string; usedBusinessPolicies: boolean } => {
      return {
        xml: `<SellerProfiles>
      <SellerShippingProfile><ShippingProfileID>${sellerProfiles!.shippingProfileId}</ShippingProfileID></SellerShippingProfile>
      <SellerReturnProfile><ReturnProfileID>${sellerProfiles!.returnProfileId}</ReturnProfileID></SellerReturnProfile>
      ${sellerProfiles!.paymentProfileId ? `<SellerPaymentProfile><PaymentProfileID>${sellerProfiles!.paymentProfileId}</PaymentProfileID></SellerPaymentProfile>` : ''}
    </SellerProfiles>`,
        usedBusinessPolicies: true,
      };
    };

    const buildVariationsBlock = (): { xml: string; hasVariations: boolean } => {
      // Normalise the many shapes the importer / extension can hand us into the
      // single { type, value, price?, quantity?, available?, image? } shape that
      // the rest of this builder expects. Without this normalisation the eBay
      // listing was being created without any of the imported colour / size
      // variations because the strict `v.type && v.value` filter dropped every
      // entry that used a different field name (e.g. `name`/`option`, or a
      // grouped `{ name, values: [...] }` payload).
      const siteIdForNames = creds.siteId || '3';
      const usesUkSpelling = siteIdForNames === '3' || siteIdForNames === '15' /* AU */ || siteIdForNames === '2' /* CA */;
      const normaliseTypeName = (raw: string): string => {
        const trimmed = String(raw).trim();
        if (!trimmed) return '';
        const lower = trimmed.toLowerCase();
        // eBay item-specific names are case-insensitive but most categories use
        // a canonical casing. Map the most common variation axes so the
        // VariationSpecificsSet matches what eBay expects per site.
        if (lower === 'colour' || lower === 'color') return usesUkSpelling ? 'Colour' : 'Color';
        if (lower === 'size') return 'Size';
        if (lower === 'material') return 'Material';
        if (lower === 'style') return 'Style';
        if (lower === 'pattern') return 'Pattern';
        // Fall back to Title Case for any other axis.
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      };
      const normalised: any[] = [];
      for (const raw of (product.variations || [])) {
        if (!raw || typeof raw !== 'object') continue;
        const r: any = raw;
        const typeRaw = r.type || r.name || r.optionName || r.attribute || r.axis;
        if (!typeRaw) continue;
        const typeName = normaliseTypeName(String(typeRaw));
        if (!typeName) continue;
        const collectImages = (obj: any): string[] => {
          const arr: string[] = [];
          if (Array.isArray(obj?.images)) for (const u of obj.images) if (typeof u === 'string') arr.push(u);
          const single = obj?.image || obj?.imageUrl || obj?.picture || obj?.img;
          if (typeof single === 'string' && !arr.includes(single)) arr.push(single);
          return arr;
        };
        // Single-entry-per-value shape: { type/name, value, ... }.
        if (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') {
          const imgs = collectImages(r);
          normalised.push({
            type: typeName,
            value: String(r.value).trim(),
            price: r.price !== undefined ? String(r.price) : undefined,
            quantity: typeof r.quantity === 'number' ? r.quantity : (r.quantity !== undefined && !isNaN(parseInt(r.quantity)) ? parseInt(r.quantity) : undefined),
            available: r.available !== false,
            image: imgs[0],
            images: imgs,
          });
          continue;
        }
        // Grouped shape: { type/name, values: [...] | options: [...] }.
        const valuesArr = Array.isArray(r.values) ? r.values : (Array.isArray(r.options) ? r.options : null);
        if (valuesArr && valuesArr.length > 0) {
          for (const item of valuesArr) {
            if (item === null || item === undefined) continue;
            // Each item can be a plain string OR a richer object with its own price/qty/image.
            if (typeof item === 'string' || typeof item === 'number') {
              const valueStr = String(item).trim();
              if (!valueStr) continue;
              normalised.push({ type: typeName, value: valueStr, available: true, images: [] });
            } else if (typeof item === 'object') {
              const valueRaw = item.value ?? item.name ?? item.label ?? item.option;
              if (valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') continue;
              const imgs = collectImages(item);
              normalised.push({
                type: typeName,
                value: String(valueRaw).trim(),
                price: item.price !== undefined ? String(item.price) : undefined,
                quantity: typeof item.quantity === 'number' ? item.quantity : (item.quantity !== undefined && !isNaN(parseInt(item.quantity)) ? parseInt(item.quantity) : undefined),
                available: item.available !== false,
                image: imgs[0],
                images: imgs,
              });
            }
          }
        }
      }
      const rawVariations = normalised.filter(v => v && v.type && v.value);
      if (rawVariations.length === 0) {
        if ((product.variations || []).length > 0) {
          console.warn(`[eBay Variations] Normalised 0 variations from ${(product.variations || []).length} input rows for "${(product.title || '').slice(0, 60)}"; raw shape may be unsupported. Sample: ${JSON.stringify((product.variations || [])[0]).slice(0, 200)}`);
        }
        return { xml: '', hasVariations: false };
      }
      console.log(`[eBay Variations] Built ${rawVariations.length} variation entrie(s) for "${(product.title || '').slice(0, 60)}" — types: ${Array.from(new Set(rawVariations.map(v => v.type))).join(', ')}`);

      const grouped: Record<string, { values: string[]; entries: { value: string; price?: string; quantity?: number; available: boolean; image?: string; images: string[] }[] }> = {};
      for (const v of rawVariations) {
        const t = v.type;
        if (!grouped[t]) grouped[t] = { values: [], entries: [] };
        if (!grouped[t].values.includes(v.value)) grouped[t].values.push(v.value);
        // Allow http(s) only here. Data URLs would have been converted to
        // eBay-hosted https URLs by convertImagesForEbay above; if conversion
        // failed we drop the image so eBay accepts the listing rather than
        // rejecting the whole publish on an invalid PictureURL.
        const httpImages = Array.isArray(v.images)
          ? v.images.filter((u: any): u is string => typeof u === 'string' && u.startsWith('http'))
          : [];
        if (typeof v.image === 'string' && v.image.startsWith('http') && !httpImages.includes(v.image)) {
          httpImages.unshift(v.image);
        }
        grouped[t].entries.push({
          value: v.value,
          price: v.price,
          quantity: typeof v.quantity === 'number' ? v.quantity : undefined,
          available: v.available !== false,
          image: httpImages[0],
          images: httpImages,
        });
      }
      const types = Object.keys(grouped);
      if (types.length === 0) return { xml: '', hasVariations: false };

      const specificsSetXml = types.map(t =>
        `<NameValueList><Name>${escapeXml(t)}</Name>${grouped[t].values.map(val => `<Value>${escapeXml(val)}</Value>`).join('')}</NameValueList>`
      ).join('\n        ');

      type Combo = { specs: { name: string; value: string }[]; price: string; quantity: number };
      const combos: Combo[] = [];

      if (types.length === 1) {
        const t = types[0];
        for (const entry of grouped[t].entries) {
          const price = entry.price && parseFloat(entry.price) > 0 ? entry.price : product.price;
          const qty = entry.available ? (entry.quantity ?? product.quantity ?? 1) : 0;
          combos.push({ specs: [{ name: t, value: entry.value }], price, quantity: qty });
        }
      } else {
        // Multi-axis: cartesian product using unique values; base price unless a matching entry has its own price
        const priceMap: Record<string, { price?: string; available: boolean }> = {};
        for (const t of types) {
          for (const e of grouped[t].entries) {
            priceMap[`${t}::${e.value}`] = { price: e.price, available: e.available };
          }
        }
        const build = (idx: number, current: { name: string; value: string }[]): void => {
          if (idx === types.length) {
            let price = product.price;
            let available = true;
            for (const s of current) {
              const info = priceMap[`${s.name}::${s.value}`];
              if (info?.price && parseFloat(info.price) > 0) price = info.price;
              if (info && info.available === false) available = false;
            }
            combos.push({ specs: [...current], price, quantity: available ? (product.quantity ?? 1) : 0 });
            return;
          }
          const t = types[idx];
          for (const val of grouped[t].values) {
            current.push({ name: t, value: val });
            build(idx + 1, current);
            current.pop();
          }
        };
        build(0, []);
      }

      const shortHash = (s: string): string => {
        let h = 0;
        for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
        return Math.abs(h).toString(36).substring(0, 5);
      };
      const variationItemsXml = combos.map((c, i) => {
        const specsXml = c.specs.map(s =>
          `<NameValueList><Name>${escapeXml(s.name)}</Name><Value>${escapeXml(s.value)}</Value></NameValueList>`
        ).join('');
        const baseSku = (product.sku || 'SKU').substring(0, 30);
        const specsKey = c.specs.map(s => `${s.name}:${s.value}`).join('|');
        const specsSuffix = c.specs.map(s => s.value.replace(/[^a-zA-Z0-9]/g, '')).join('-').substring(0, 12);
        const variationSku = `${baseSku}-${specsSuffix}-${shortHash(specsKey)}`.substring(0, 50);
        return `<Variation>
          <SKU>${escapeXml(variationSku)}</SKU>
          <StartPrice>${c.price}</StartPrice>
          <Quantity>${c.quantity}</Quantity>
          <VariationSpecifics>${specsXml}</VariationSpecifics>
        </Variation>`;
      }).join('\n        ');

      // Build <Pictures> block — eBay allows images only for ONE variation axis
      // (typically Colour). Pick the first axis that has any variation with at
      // least one image. eBay allows up to 12 PictureURLs per colour value, so
      // when the seller attached multiple gallery shots for one colour, emit
      // them all so the gallery actually swaps when the buyer picks that
      // colour.
      let picturesXml = '';
      for (const t of types) {
        const entriesWithImg = grouped[t].entries.filter(e => e.images && e.images.length > 0);
        if (entriesWithImg.length === 0) continue;
        const seen = new Set<string>();
        const pictureSets: string[] = [];
        for (const e of entriesWithImg) {
          if (seen.has(e.value)) continue;
          seen.add(e.value);
          const picUrls = e.images.slice(0, 12).map(u => `<PictureURL>${escapeXml(u)}</PictureURL>`).join('\n          ');
          pictureSets.push(
            `<VariationSpecificPictureSet>
          <VariationSpecificValue>${escapeXml(e.value)}</VariationSpecificValue>
          ${picUrls}
        </VariationSpecificPictureSet>`
          );
        }
        if (pictureSets.length > 0) {
          picturesXml = `
      <Pictures>
        <VariationSpecificName>${escapeXml(t)}</VariationSpecificName>
        ${pictureSets.join('\n        ')}
      </Pictures>`;
        }
        break;
      }

      const xml = `
    <Variations>
      <VariationSpecificsSet>
        ${specificsSetXml}
      </VariationSpecificsSet>
      ${variationItemsXml}${picturesXml}
    </Variations>`;
      return { xml, hasVariations: true };
    };

    const buildItemXml = (sanitized: { title: string; description: string }, opts: { altConditionId?: string } = {}) => {
      const policy = buildPolicyXml();
      const cid = opts.altConditionId || conditionId;
      const variationsResult = buildVariationsBlock();
      const topLevelPriceQtySku = variationsResult.hasVariations
        ? `<SKU>${escapeXml(product.sku)}</SKU>`
        : `<StartPrice>${product.price}</StartPrice>
    <Quantity>${product.quantity}</Quantity>
    <SKU>${escapeXml(product.sku)}</SKU>`;
      return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${escapeXml(sanitized.title)}</Title>
    <Description><![CDATA[${sanitized.description}]]></Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <ConditionID>${cid}</ConditionID>
    <Country>${itemCountry}</Country>
    <Currency>${siteConfig.currency}</Currency>
    <Location>${escapeXml(itemLocation)}</Location>
    ${itemPostalCode ? `<PostalCode>${escapeXml(itemPostalCode)}</PostalCode>` : ''}
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    ${topLevelPriceQtySku}
    <PictureDetails>
      ${product.images.filter(i => i?.startsWith('http')).slice(0, 24).map(img => 
        `<PictureURL>${escapeXml(img)}</PictureURL>`
      ).join('\n      ')}
    </PictureDetails>
    ${itemSpecificsXml}${variationsResult.xml}
    ${policy.xml}
  </Item>
</AddFixedPriceItemRequest>`;
    };

    const callEbayPublish = async (itemXml: string, attempt: string, _rateLimitRetry: number = 0): Promise<{ success: boolean; externalId?: string; listingUrl?: string; error?: string; isPolicyError?: boolean; isShippingLocationError?: boolean; errorCodes?: string[] }> => {
      try {
        const response = await fetch('https://api.ebay.com/ws/api.dll', {
          method: 'POST',
          headers: makeEbayHeaders(creds, 'AddFixedPriceItem'),
          body: itemXml,
        });

        const responseText = await response.text();
        console.log(`eBay publishProduct [${attempt}] HTTP ${response.status}, response length: ${responseText.length}`);
        console.log(`eBay publishProduct [${attempt}] response: ${responseText.substring(0, 3000)}`);
        
        const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/);
        const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
        
        if (ackMatch && (ackMatch[1] === 'Success' || ackMatch[1] === 'Warning') && itemIdMatch) {
          return {
            success: true,
            externalId: itemIdMatch[1],
            listingUrl: `https://${siteConfig.domain}/itm/${itemIdMatch[1]}`,
          };
        }

        const errorBlocks = [...responseText.matchAll(/<Errors>([\s\S]*?)<\/Errors>/g)];
        const realErrors: string[] = [];
        const errorCodes: string[] = [];
        for (const block of errorBlocks) {
          const severity = block[1].match(/<SeverityCode>(\w+)<\/SeverityCode>/);
          if (severity && severity[1] === 'Error') {
            const longMsg = block[1].match(/<LongMessage>([^<]+)<\/LongMessage>/);
            const shortMsg = block[1].match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
            const errorCode = block[1].match(/<ErrorCode>(\d+)<\/ErrorCode>/);

            const paramValues = [...block[1].matchAll(/<ErrorParameters[^>]*>\s*<Value>([^<]+)<\/Value>\s*<\/ErrorParameters>/g)]
              .map(m => m[1])
              .filter(v => v && v.length > 0);

            let errorMsg = longMsg?.[1] || shortMsg?.[1] || 'Unknown eBay error';

            if (paramValues.length > 0) {
              const cleanedParams = paramValues.map(v =>
                v.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').trim()
              ).filter(v => v.length > 0);
              if (cleanedParams.length > 0) {
                // Long params (>10 chars) are usually the full descriptive
                // sentence eBay returns. Short params are the offending
                // value/name (e.g. "Material", "10M (Pack of 10)") — we
                // append them so the user sees WHICH specific failed.
                const longParam = cleanedParams.find(v => v.length > 10);
                const shortParams = cleanedParams.filter(v => v.length <= 30);
                if (longParam) {
                  errorMsg = shortParams.length > 0
                    ? `${longParam} (offending value: ${shortParams.join(', ')})`
                    : longParam;
                } else {
                  errorMsg = `${errorMsg} — ${shortParams.join(', ')}`;
                }
              }
            }

            realErrors.push(errorMsg);
            if (errorCode) errorCodes.push(errorCode[1]);
          }
        }

        console.log(`eBay publishProduct [${attempt}] error codes: ${errorCodes.join(', ')}, errors: ${realErrors.join(' | ')}`);

        const isShippingLocationError = realErrors.some(e => 
          e.toLowerCase().includes('postage service') || e.toLowerCase().includes('shipping service') ||
          e.toLowerCase().includes('item location') || e.toLowerCase().includes('posts from outside')
        );

        const isPolicyError = !isShippingLocationError && (realErrors.some(e => 
          e.includes('improper words') || e.includes('violation of eBay policy') || 
          e.includes('cannot be listed or modified')
        ) || errorCodes.includes('240'));

        const isConditionError = errorCodes.some(c => ['21916686', '21916687', '21916299'].includes(c)) ||
          realErrors.some(e => e.toLowerCase().includes('condition'));

        const isProfileError = errorCodes.some(c => ['21919188', '21919301', '21916841', '21919303'].includes(c)) ||
          realErrors.some(e => e.toLowerCase().includes('business polic') || e.toLowerCase().includes('profile'));

        // eBay error 518 = "Your application has exceeded usage limit on this call".
        // This is a per-call quota enforced by eBay (not by us). Many 518 hits
        // are short bursts that clear within seconds, so retry transparently
        // with backoff BEFORE surfacing anything — but keep the total in-request
        // wait under ~30s so we don't blow common HTTP/proxy timeouts (publish
        // runs inline inside the user's request).
        // ONLY auto-retry when 518 is the sole blocking error; if any other
        // fatal error is also present, surface it immediately so it isn't
        // hidden behind a soft rate-limit message.
        const isRateLimit = errorCodes.includes('518') ||
          realErrors.some(e => e.toLowerCase().includes('exceeded usage limit'));
        const onlyBlockerIsRateLimit = isRateLimit && errorCodes.every(c =>
          c === '518' || c === '21916584' /* warning-level "minor" codes can stay */
        ) && realErrors.every(e =>
          e.toLowerCase().includes('exceeded usage limit')
        );
        if (isRateLimit && onlyBlockerIsRateLimit) {
          const RATE_LIMIT_BACKOFFS_MS = [10_000, 20_000]; // ~30s total worst-case
          if (_rateLimitRetry < RATE_LIMIT_BACKOFFS_MS.length) {
            const waitMs = RATE_LIMIT_BACKOFFS_MS[_rateLimitRetry];
            console.warn(`[eBay] Rate-limit (518) on publish [${attempt}] — auto-retrying in ${waitMs}ms (retry ${_rateLimitRetry + 1}/${RATE_LIMIT_BACKOFFS_MS.length})`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            return callEbayPublish(itemXml, `${attempt}-rl${_rateLimitRetry + 1}`, _rateLimitRetry + 1);
          }
          console.error(`[eBay] Rate-limit (518) on publish — exhausted ${RATE_LIMIT_BACKOFFS_MS.length} auto-retries; surfacing soft error to user`);
          return {
            success: false,
            error: "eBay is temporarily busy and couldn't accept the listing right now. This usually clears within a few minutes — please try publishing again shortly.",
            isPolicyError: false,
            errorCodes,
          };
        }

        if (realErrors.length > 0) {
          return { success: false, error: realErrors.join(' | '), isPolicyError: isPolicyError || isConditionError || isProfileError, isShippingLocationError, errorCodes };
        }

        const longErrorMatch = responseText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
        const shortErrorMatch = responseText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
        return {
          success: false,
          error: longErrorMatch?.[1] || shortErrorMatch?.[1] || `eBay API error: ${ackMatch?.[1] || 'Unknown error'}`,
          isPolicyError: false,
          errorCodes,
        };
      } catch (err: any) {
        return { success: false, error: `Failed to connect to eBay: ${err.message}`, isPolicyError: false, errorCodes: [] };
      }
    };

    // Generate a richer, spec-driven description using AI before publishing.
    // If AI is unavailable or returns nothing, the original description is used as-is.
    try {
      const aiDescription = await generateAIDescription({
        title: product.title,
        description: product.description,
        brand: (product as any).brand,
        attributes: (product as any).attributes,
        categoryName: (product as any).categoryName,
      });
      if (aiDescription && aiDescription.length > 80) {
        console.log(`[eBay AI Description] Generated ${aiDescription.length}-char description for "${product.title.slice(0, 60)}"`);
        product.description = aiDescription;
      }
    } catch (aiErr: any) {
      console.warn(`[eBay AI Description] Skipped due to error: ${aiErr.message}`);
    }

    const sanitized = sanitizeForEbay(product.title, product.description || product.title);
    if (sanitized.warnings.length > 0) {
      console.log(`eBay publish sanitization warnings: ${sanitized.warnings.join('; ')}`);
    }

    const firstResult = await callEbayPublish(buildItemXml(sanitized), 'attempt-1');
    if (firstResult.success) {
      return { success: true, externalId: firstResult.externalId!, listingUrl: firstResult.listingUrl };
    }

    // eBay error 21920061 = "Variation Specifics Invalid". Common cause: the
    // axis name we used (e.g. "Material") is a strict-enum item-specific in
    // the chosen category, and our values (e.g. "10M", "10M (Pack of 10)")
    // aren't on eBay's allowed list for that name. "Type" is accepted as a
    // generic variation axis in almost every category.
    //
    // SAFETY: only attempt the rename retry when there's a SINGLE variation
    // axis. Collapsing multiple distinct axes (Size + Colour) to a single
    // "Type" key would merge dimensions and produce a malformed buyer
    // experience — better to surface the original error than silently sell
    // a broken matrix.
    let retryFailureNote = '';
    const isVariationSpecificError = (firstResult.errorCodes || []).includes('21920061');
    if (isVariationSpecificError && Array.isArray(product.variations) && product.variations.length > 0) {
      const distinctAxes = new Set(
        (product.variations as any[]).map((v: any) => String(v?.type || v?.name || '').trim().toLowerCase()).filter(Boolean)
      );
      if (distinctAxes.size === 1) {
        console.log(`[eBay] Got 21920061 (Invalid variation specific) on single-axis listing. Retrying with axis renamed to "Type"...`);
        const originalVariations = product.variations;
        try {
          product.variations = (originalVariations as any[]).map((v: any) => ({ ...v, type: 'Type' })) as any;
          const retryResult = await callEbayPublish(buildItemXml(sanitized), 'retry-axis-as-type');
          if (retryResult.success) {
            console.log(`[eBay] Retry with "Type" axis succeeded for "${product.title.slice(0, 60)}"`);
            return { success: true, externalId: retryResult.externalId!, listingUrl: retryResult.listingUrl };
          }
          // Capture retry diagnostics so the final user-facing message
          // surfaces both the original and fallback failures.
          if (retryResult.error) {
            retryFailureNote = ` | Retry as "Type" also failed: ${retryResult.error}${(retryResult.errorCodes && retryResult.errorCodes.length > 0) ? ` [${retryResult.errorCodes.join(', ')}]` : ''}`;
          }
        } finally {
          product.variations = originalVariations;
        }
      } else {
        console.log(`[eBay] Got 21920061 but listing has ${distinctAxes.size} variation axes — skipping "Type" rename retry to avoid merging dimensions.`);
      }
    }

    if ((firstResult as any).isShippingLocationError) {
      const codeStr = firstResult.errorCodes?.length ? ` [eBay error code: ${firstResult.errorCodes.join(', ')}]` : '';
      return { success: false, externalId: '', error: `${firstResult.error}${codeStr} — Please update your eBay shipping/business policy to use a postage service that matches your item location (e.g. use a UK domestic service if your location is United Kingdom). You can fix this in eBay Seller Hub → Business Policies → Shipping.` };
    }

    if (firstResult.isPolicyError) {
      let latestResult = firstResult;

      console.log(`eBay publish: attempt-1 failed (codes: ${firstResult.errorCodes?.join(',') || 'none'}), retrying with plain-text description...`);
      const plainSanitized = sanitizeForEbay(product.title, product.description || product.title, true);
      const retryResult = await callEbayPublish(buildItemXml(plainSanitized), 'retry-plaintext');
      if (retryResult.success) {
        return { success: true, externalId: retryResult.externalId!, listingUrl: retryResult.listingUrl };
      }
      latestResult = retryResult;

      if (conditionId === '1000') {
        console.log(`eBay publish: retrying with ConditionID 1500 (New other)...`);
        const altCondResult = await callEbayPublish(
          buildItemXml(plainSanitized, { altConditionId: '1500' }),
          'retry-condition-1500'
        );
        if (altCondResult.success) {
          return { success: true, externalId: altCondResult.externalId!, listingUrl: altCondResult.listingUrl };
        }
        latestResult = altCondResult;
      }

      const lastError = latestResult.error || 'Unknown error';
      const lastCodes = (latestResult.errorCodes && latestResult.errorCodes.length > 0) ? latestResult.errorCodes : (firstResult.errorCodes || []);
      const codeStr = lastCodes.length > 0 ? ` [eBay error code: ${lastCodes.join(', ')}]` : '';
      const friendlyError = lastError.includes('improper words') || lastError.includes('violation of eBay policy') || lastError.includes('cannot be listed or modified')
        ? `${lastError}${codeStr} — This may be an eBay account restriction. Check your eBay seller dashboard for any account holds or policy notices, and ensure the product title doesn't contain trademarked words.`
        : `${lastError}${codeStr}`;

      return { success: false, externalId: '', error: friendlyError };
    }

    const firstCodes = firstResult.errorCodes || [];
    const codeStr = firstCodes.length > 0 ? ` [eBay error code: ${firstCodes.join(', ')}]` : '';
    const friendlyErrors = (firstResult.error || '').split(' | ').map(e => {
      if (e.includes('token') || e.includes('auth') || e.includes('Auth')) {
        return `${e} — Please reconnect your eBay account from the Stores page.`;
      }
      return e;
    }).join(' | ');

    return { success: false, externalId: '', error: `${friendlyErrors}${codeStr}${retryFailureNote}` };
  }
};

export async function reviseEbayPrice(credentials: any, itemId: string, newPrice: string): Promise<{ success: boolean; error?: string }> {
  return reviseEbayListing(credentials, itemId, { price: newPrice });
}

/**
 * Push (or replace) an eBay shipping fulfillment for an order.
 * - Looks up any existing fulfillments on the order.
 * - Deletes them (so the new converted/corrected tracking fully replaces the old one).
 * - Creates the new fulfillment with the supplied tracking number / carrier code.
 * Returns { success, replaced (count of deleted), error }.
 */
export async function pushOrReplaceEbayFulfillment(
  accessToken: string,
  ebayOrderId: string,
  payload: { trackingNumber: string; shippingCarrierCode: string; lineItems: { lineItemId: string; quantity: number }[] }
): Promise<{ success: boolean; replaced: number; error?: string; fulfillmentId?: string }> {
  let replaced = 0;
  // 1. List existing fulfillments and delete them so the new one fully replaces.
  try {
    const listResp = await fetch(
      `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
    );
    if (listResp.ok) {
      const listData = await listResp.json();
      const existing: any[] = listData.fulfillments || listData.shippingFulfillments || [];
      for (const f of existing) {
        const fid = f.fulfillmentId || f.fulfillment_id;
        if (!fid) continue;
        try {
          const delResp = await fetch(
            `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment/${fid}`,
            { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (delResp.ok || delResp.status === 204) {
            replaced++;
            console.log(`[eBay Tracking] Deleted existing fulfillment ${fid} on order ${ebayOrderId} so new tracking can replace it`);
          } else {
            const dt = await delResp.text();
            console.warn(`[eBay Tracking] Could not delete existing fulfillment ${fid} on order ${ebayOrderId}: ${dt}`);
          }
        } catch (delErr: any) {
          console.warn(`[eBay Tracking] Delete error for fulfillment ${fid}: ${delErr.message}`);
        }
      }
    }
  } catch (listErr: any) {
    console.warn(`[eBay Tracking] Could not list existing fulfillments for order ${ebayOrderId}: ${listErr.message}`);
  }

  // 2. Create the new fulfillment with converted tracking.
  const createResp = await fetch(
    `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (createResp.ok) {
    const loc = createResp.headers.get('location') || '';
    const fid = loc.split('/').pop() || undefined;
    return { success: true, replaced, fulfillmentId: fid };
  }
  const errText = await createResp.text();
  return { success: false, replaced, error: errText };
}

export async function reviseEbayListing(credentials: any, itemId: string, updates: { price?: string; quantity?: number; images?: string[]; variations?: { type: string; value: string; available?: boolean; price?: string; quantity?: number; image?: string; images?: string[] }[] }): Promise<{ success: boolean; error?: string }> {
  const creds = getFullCredentials(credentials);

  let itemFields = `<ItemID>${itemId}</ItemID>`;
  if (updates.price) {
    itemFields += `\n    <StartPrice>${updates.price}</StartPrice>`;
  }
  // Push stock changes back to eBay so inventory edits in the dashboard are
  // reflected on the live listing. eBay only accepts the top-level <Quantity>
  // on non-variation listings — variation listings carry per-variation
  // <Quantity> instead, so we suppress this when variations are present.
  const hasVariations = Array.isArray(updates.variations) && updates.variations.length > 0;
  if (typeof updates.quantity === 'number' && updates.quantity >= 0 && !hasVariations) {
    itemFields += `\n    <Quantity>${Math.floor(updates.quantity)}</Quantity>`;
  }

  // Push picture changes back to eBay so newly uploaded photos appear on the
  // live listing. Without this <PictureDetails> block, ReviseFixedPriceItem
  // leaves the original gallery untouched and users see no change.
  if (Array.isArray(updates.images) && updates.images.length > 0) {
    const pics = updates.images
      .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
      .slice(0, 24);
    if (pics.length > 0) {
      const escPic = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
      itemFields += `\n    <PictureDetails>\n      ${pics.map(p => `<PictureURL>${escPic(p)}</PictureURL>`).join('\n      ')}\n    </PictureDetails>`;
    }
  }

  let variationsXml = '';
  if (updates.variations && updates.variations.length > 0) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    const grouped: Record<string, { values: Set<string>; entries: { value: string; available: boolean; price?: string; quantity?: number; images: string[] }[] }> = {};
    for (const v of updates.variations) {
      if (!v.type || !v.value) continue;
      if (!grouped[v.type]) grouped[v.type] = { values: new Set(), entries: [] };
      grouped[v.type].values.add(v.value);
      // Accept either a single `image` or a multi-image `images` array per
      // colour. Multi-image is what eBay actually supports for swapping the
      // gallery when a buyer picks a colour.
      const imgs = Array.isArray(v.images)
        ? v.images.filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
        : (typeof v.image === 'string' && v.image.startsWith('http') ? [v.image] : []);
      grouped[v.type].entries.push({ value: v.value, available: v.available !== false, price: v.price, quantity: v.quantity, images: imgs });
    }
    const types = Object.keys(grouped);
    if (types.length > 0) {
      const variationSpecificsSetXml = types.map(t =>
        `<NameValueList><Name>${esc(t)}</Name>${[...grouped[t].values].map(val => `<Value>${esc(val)}</Value>`).join('')}</NameValueList>`
      ).join('\n          ');

      const basePrice = updates.price || '0';
      let allCombos: { specs: { name: string; value: string }[]; available: boolean; price: string; quantity: number }[] = [];

      if (types.length === 1) {
        const t = types[0];
        for (const entry of grouped[t].entries) {
          const p = entry.price && parseFloat(entry.price) > 0 ? entry.price : basePrice;
          const q = entry.available ? (entry.quantity ?? 1) : 0;
          allCombos.push({ specs: [{ name: t, value: entry.value }], available: entry.available, price: p, quantity: q });
        }
      } else {
        const priceMap: Record<string, { price?: string; available: boolean }> = {};
        for (const t of types) {
          for (const e of grouped[t].entries) priceMap[`${t}::${e.value}`] = { price: e.price, available: e.available };
        }
        const buildCombos = (index: number, current: { name: string; value: string }[]): void => {
          if (index === types.length) {
            let p = basePrice;
            let avail = true;
            for (const s of current) {
              const info = priceMap[`${s.name}::${s.value}`];
              if (info?.price && parseFloat(info.price) > 0) p = info.price;
              if (info && info.available === false) avail = false;
            }
            allCombos.push({ specs: [...current], available: avail, price: p, quantity: avail ? 1 : 0 });
            return;
          }
          const t = types[index];
          for (const val of [...grouped[t].values]) {
            current.push({ name: t, value: val });
            buildCombos(index + 1, current);
            current.pop();
          }
        };
        buildCombos(0, []);
      }

      const variationItems = allCombos.map(c => {
        const specsXml = c.specs.map(s =>
          `<NameValueList><Name>${esc(s.name)}</Name><Value>${esc(s.value)}</Value></NameValueList>`
        ).join('');
        return `<Variation>
            <StartPrice>${c.price}</StartPrice>
            <Quantity>${c.quantity}</Quantity>
            <VariationSpecifics>${specsXml}</VariationSpecifics>
          </Variation>`;
      }).join('\n        ');

      // Build a <Pictures> block so the listing's gallery swaps when the buyer
      // changes the colour. eBay only lets us attach pictures to ONE variation
      // axis (typically Colour). Pick the first axis that has any per-value
      // image. Without this block, picking a colour on the live listing leaves
      // the picture unchanged — which is exactly what users were seeing.
      let revisePicturesXml = '';
      for (const t of types) {
        const entriesWithImg = grouped[t].entries.filter(e => e.images.length > 0);
        if (entriesWithImg.length === 0) continue;
        const seen = new Set<string>();
        const pictureSets: string[] = [];
        for (const e of entriesWithImg) {
          if (seen.has(e.value)) continue;
          seen.add(e.value);
          const picUrls = e.images.slice(0, 12).map(u => `<PictureURL>${esc(u)}</PictureURL>`).join('\n          ');
          pictureSets.push(
            `<VariationSpecificPictureSet>
          <VariationSpecificValue>${esc(e.value)}</VariationSpecificValue>
          ${picUrls}
        </VariationSpecificPictureSet>`
          );
        }
        if (pictureSets.length > 0) {
          revisePicturesXml = `
      <Pictures>
        <VariationSpecificName>${esc(t)}</VariationSpecificName>
        ${pictureSets.join('\n        ')}
      </Pictures>`;
        }
        break;
      }

      variationsXml = `
    <Variations>
      <VariationSpecificsSet>
        ${variationSpecificsSetXml}
      </VariationSpecificsSet>
      ${variationItems}${revisePicturesXml}
    </Variations>`;
    }
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    ${itemFields}${variationsXml}
  </Item>
</ReviseFixedPriceItemRequest>`;

  try {
    const response = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'ReviseFixedPriceItem'),
      body: xml,
    });
    const responseText = await response.text();
    const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
    if (ackMatch && (ackMatch[1] === 'Success' || ackMatch[1] === 'Warning')) {
      return { success: true };
    }
    const errorMatch = responseText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
    return { success: false, error: errorMatch?.[1] || 'eBay ReviseItem failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to revise eBay listing' };
  }
}

/**
 * Update only the quantity (and optionally price) of one or more live eBay
 * listings using the lightweight ReviseInventoryStatus call. eBay accepts up
 * to 4 InventoryStatus elements per request and grants this call a much
 * higher daily quota than ReviseFixedPriceItem — perfect for the
 * auto-restock loop which fires after every order sync.
 *
 * Each entry must carry the eBay ItemID. SKU is included when available so
 * eBay can resolve variation listings to the correct child SKU.
 */
export async function reviseEbayQuantity(
  credentials: any,
  items: { itemId: string; sku?: string; quantity: number }[],
): Promise<{ success: boolean; error?: string; failed: { itemId: string; error: string }[] }> {
  const creds = getFullCredentials(credentials);
  const failed: { itemId: string; error: string }[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, failed };
  }

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // Process in batches of 4 (eBay's hard limit per ReviseInventoryStatus call).
  for (let i = 0; i < items.length; i += 4) {
    const batch = items.slice(i, i + 4);
    const inventoryStatusXml = batch.map((it) => {
      const qty = Math.max(0, Math.floor(it.quantity));
      const skuLine = it.sku ? `\n    <SKU>${esc(it.sku)}</SKU>` : '';
      return `  <InventoryStatus>
    <ItemID>${esc(it.itemId)}</ItemID>${skuLine}
    <Quantity>${qty}</Quantity>
  </InventoryStatus>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${inventoryStatusXml}
</ReviseInventoryStatusRequest>`;

    try {
      const response = await fetch('https://api.ebay.com/ws/api.dll', {
        method: 'POST',
        headers: makeEbayHeaders(creds, 'ReviseInventoryStatus'),
        body: xml,
      });
      const responseText = await response.text();
      const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
      const ack = ackMatch?.[1] || 'Unknown';

      if (ack === 'Success' || ack === 'Warning') {
        // Even on Success/Warning eBay can return per-item errors. Walk the
        // <Errors> blocks and mark only the failed ItemIDs so the caller can
        // retry / disable just those listings.
        const errorRegex = /<Errors>([\s\S]*?)<\/Errors>/g;
        let m: RegExpExecArray | null;
        while ((m = errorRegex.exec(responseText)) !== null) {
          const block = m[1];
          const sev = block.match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
          if (sev !== 'Error') continue;
          const longMsg = block.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1] || 'eBay rejected the inventory update';
          const itemIdInError = block.match(/<Value>(\d{6,})<\/Value>/)?.[1];
          if (itemIdInError) {
            failed.push({ itemId: itemIdInError, error: longMsg });
          } else {
            // Errors block without a specific ItemID — fail the whole batch
            // so callers can decide what to do.
            for (const it of batch) failed.push({ itemId: it.itemId, error: longMsg });
          }
        }
      } else {
        const errorMatch = responseText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
        const errMsg = errorMatch?.[1] || `eBay ReviseInventoryStatus failed (HTTP ${response.status})`;
        for (const it of batch) failed.push({ itemId: it.itemId, error: errMsg });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error calling ReviseInventoryStatus';
      for (const it of batch) failed.push({ itemId: it.itemId, error: errMsg });
    }
  }

  return { success: failed.length === 0, failed };
}

export async function getEbayUserIdentity(authToken: string): Promise<{ userId: string; username: string } | null> {
  // Cache identity per token for 24h. The token is per-seller and changes when they
  // reconnect — so once we've verified who it belongs to, repeating the GetUser call
  // on every publish just wastes our daily call quota (eBay error 518).
  return _cached(`identity:${_tokenKey(authToken)}`, 24 * 60 * 60 * 1000, () => _getEbayUserIdentityUncached(authToken));
}
async function _getEbayUserIdentityUncached(authToken: string): Promise<{ userId: string; username: string } | null> {
  const creds = getFullCredentials({ authToken });
  // Use OutputSelector to fetch ONLY UserID + EIASToken — this is the lightest
  // variant of GetUser and has a far higher daily call quota than the default
  // (and especially than DetailLevel=ReturnAll). Identity verification gets
  // hammered at OAuth time, so we must minimise the per-call cost (eBay error
  // 518 = "Your application has exceeded usage limit on this call").
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <OutputSelector>UserID</OutputSelector>
  <OutputSelector>EIASToken</OutputSelector>
</GetUserRequest>`;
  try {
    const response = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: makeEbayHeaders(creds, 'GetUser'),
      body: xml,
    });
    const responseText = await response.text();
    const userIdMatch = responseText.match(/<UserID[^>]*>([^<]+)<\/UserID>/);
    const eiaTokenMatch = responseText.match(/<EIASToken>([^<]+)<\/EIASToken>/);
    if (userIdMatch) {
      return { userId: eiaTokenMatch?.[1] || '', username: userIdMatch[1] };
    }
    const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
    const errorCode = responseText.match(/<ErrorCode>(\d+)<\/ErrorCode>/);
    const longMsg = responseText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
    console.error(`[eBay GetUser] No UserID returned. HTTP ${response.status}, Ack=${ackMatch?.[1] || '?'}, ErrorCode=${errorCode?.[1] || '?'}, Msg="${longMsg?.[1] || ''}"`);
    return null;
  } catch (err) {
    console.error('Failed to get eBay user identity:', err);
    return null;
  }
}

export async function getEbayItemStatuses(credentials: any, itemIds: string[]): Promise<Map<string, { exists: boolean; status: string }>> {
  const creds = getFullCredentials(credentials);
  const results = new Map<string, { exists: boolean; status: string }>();

  for (const itemId of itemIds) {
    try {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${itemId}</ItemID>
  <OutputSelector>ItemID</OutputSelector>
  <OutputSelector>ListingStatus</OutputSelector>
  <OutputSelector>SellingStatus</OutputSelector>
</GetItemRequest>`;

      const response = await fetch('https://api.ebay.com/ws/api.dll', {
        method: 'POST',
        headers: makeEbayHeaders(creds, 'GetItem'),
        body: xml,
      });
      const responseText = await response.text();
      const ackMatch = responseText.match(/<Ack>(\w+)<\/Ack>/);
      if (ackMatch && (ackMatch[1] === 'Success' || ackMatch[1] === 'Warning')) {
        const statusMatch = responseText.match(/<ListingStatus>(\w+)<\/ListingStatus>/);
        const listingStatus = statusMatch?.[1] || 'Unknown';
        const isActive = listingStatus === 'Active';
        results.set(itemId, { exists: true, status: listingStatus });
      } else {
        const errorCode = responseText.match(/<ErrorCode>(\d+)<\/ErrorCode>/);
        if (errorCode?.[1] === '17' || errorCode?.[1] === '21916750') {
          results.set(itemId, { exists: false, status: 'Deleted' });
        } else {
          results.set(itemId, { exists: true, status: 'Unknown' });
        }
      }
    } catch (err: any) {
      console.error(`[eBay] Failed to check item ${itemId}:`, err.message);
      results.set(itemId, { exists: true, status: 'Unknown' });
    }
  }

  return results;
}

function sanitizeForEbay(title: string, description: string, plainTextOnly = false): { title: string; description: string; warnings: string[] } {
  const warnings: string[] = [];

  const urlPattern = /https?:\/\/[^\s<"]+|www\.[^\s<"]+/gi;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phonePattern = /(\+?\d[\d\s\-().]{7,}\d)/g;

  let cleanTitle = title
    .replace(urlPattern, '')
    .replace(emailPattern, '')
    .replace(phonePattern, '')
    .replace(/[^\w\s\-.,()'/&#+:!%"]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleanTitle !== title) {
    warnings.push('Title was sanitized to remove URLs, contact info, or unsupported characters');
  }

  let cleanDesc = description;
  const descBefore = cleanDesc;

  cleanDesc = cleanDesc
    .replace(/https?:\/\/[^\s<"]+|www\.[^\s<"]+/gi, '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/(\+?\d[\d\s\-().]{7,}\d)/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<input[^>]*\/?>/gi, '')
    .replace(/<link[^>]*\/?>/gi, '')
    .replace(/<meta[^>]*\/?>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*\/?>/gi, '')
    .replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/@import\s+[^;]+;/gi, '');

  if (plainTextOnly) {
    cleanDesc = cleanDesc
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
    warnings.push('Description converted to plain text for eBay compatibility');
  }

  cleanDesc = cleanDesc.replace(/\s{2,}/g, ' ').trim();

  if (cleanDesc !== descBefore) {
    warnings.push('Description sanitized to remove URLs, contact info, or prohibited content (eBay policy)');
  }

  if (!cleanTitle || cleanTitle.length < 2) {
    cleanTitle = 'Item for Sale';
    warnings.push('Title was too short after cleaning, using default');
  }

  return { title: cleanTitle.substring(0, 80), description: cleanDesc || cleanTitle, warnings };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
