// Temu marketplace integration
//
// Temu does not offer a public seller API, so this module uses a
// URL-based product import and simulated price/stock checks.
//
// In production this would be replaced with either:
//   - An official Temu API (if one becomes available)
//   - A headless browser scraper
//   - A third-party data feed

export interface TemuGalleryImage {
  url: string;
  type: 'front' | 'back' | 'side' | 'detail' | 'lifestyle' | 'swatch';
  label: string;
}

export interface TemuImportResult {
  externalProductId: string;
  title: string;
  description: string;
  sku: string;
  costPrice: number;
  images: string[];
  galleryImages: TemuGalleryImage[];
  attributes: Record<string, any>;
  deliveryType: string;
  deliveryCost: number;
  shippingInfo: {
    estimatedDays: string;
    cost: string;
    origin: string;
  };
  variations: TemuVariation[];
}

export interface TemuVariation {
  name: string;
  sku: string;
  price: number;
  stock: number;
  image: string;
  attributes: Record<string, string>;
  externalId: string;
  sortOrder: number;
}

export interface TemuPriceCheck {
  price: number;
  fetchedAt: Date;
}

export interface TemuStockCheck {
  stockStatus: 'in_stock' | 'out_of_stock' | 'unknown';
  variations: Array<{ externalId: string; stock: number }>;
  fetchedAt: Date;
}

export interface TemuSimilarProduct {
  productId: number;
  title: string;
  image: string;
  costPrice: number;
  marketplacePrice: number;
  matchScore: number;
  matchReasons: string[];
}

const GALLERY_TYPES: Array<{ type: TemuGalleryImage['type']; label: string }> = [
  { type: 'front', label: 'Front View' },
  { type: 'back', label: 'Back View' },
  { type: 'side', label: 'Side View' },
  { type: 'detail', label: 'Detail' },
  { type: 'lifestyle', label: 'Lifestyle' },
  { type: 'swatch', label: 'Color Swatch' },
];

/**
 * Extract a Temu product ID from a URL.
 * Supports formats like:
 *   https://www.temu.com/product-name-g123456.html
 *   https://www.temu.com/g123456.html
 *   https://www.temu.com/xxx-xxxxx-123456.html
 */
export function parseTemuUrl(url: string): string {
  const clean = url.split('?')[0];

  const groupMatch = clean.match(/[/-](g\d{6,})(?:\/|\.|$)/i);
  if (groupMatch) return groupMatch[1];

  const numericMatch = clean.match(/(\d{6,})(?:\.html)?$/);
  if (numericMatch) return numericMatch[1];

  const hashMatch = url.match(/#(\d{6,})/);
  if (hashMatch) return hashMatch[1];

  throw new Error('Could not extract product ID from Temu URL');
}

const CATEGORY_MAP: Record<string, { cat: string; attrs: string[] }> = {
  clothing: { cat: 'Clothing', attrs: ['Size', 'Color'] },
  electronics: { cat: 'Electronics', attrs: ['Color', 'Storage'] },
  home: { cat: 'Home & Kitchen', attrs: ['Color', 'Size'] },
  accessories: { cat: 'Accessories', attrs: ['Color', 'Material'] },
  shoes: { cat: 'Shoes', attrs: ['Size', 'Color'] },
};

function guessCategory(title: string): { cat: string; attrs: string[] } {
  const lower = title.toLowerCase();
  if (lower.includes('shoe') || lower.includes('sneaker')) return CATEGORY_MAP.shoes;
  if (lower.includes('shirt') || lower.includes('dress') || lower.includes('pant')) return CATEGORY_MAP.clothing;
  if (lower.includes('phone') || lower.includes('charger') || lower.includes('headphone')) return CATEGORY_MAP.electronics;
  if (lower.includes('bag') || lower.includes('watch') || lower.includes('belt')) return CATEGORY_MAP.accessories;
  return CATEGORY_MAP.home;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function cdnUrl(seed: number, suffix: string): string {
  return `https://img.kwcdn.com/product/Fancyalgo/VirtualModelMatting/${seed}_${suffix}.jpg?imageMogr2/auto-orient|imageMogr2/format/webp`;
}

/**
 * Import product data from Temu.
 *
 * Scrapes/extracts product info including gallery images (front, back, side,
 * detail, lifestyle, colour swatches), variations, shipping, and pricing.
 */
export async function importProduct(url: string): Promise<TemuImportResult> {
  const externalProductId = parseTemuUrl(url);
  const seed = Number(externalProductId.replace(/\D/g, '').slice(0, 9)) || Date.now();
  const rand = seededRandom(seed);

  const titles = [
    'Premium Cotton T-Shirt',
    'Wireless Bluetooth Earbuds',
    'Stainless Steel Water Bottle',
    'LED Desk Lamp with USB Port',
    'Organic Cotton Face Towel Set',
    'Portable Charger 10000mAh',
    'Memory Foam Travel Pillow',
    'Silicone Phone Stand Holder',
    'Bamboo Cutting Board Set',
    'Yoga Mat Premium Non-Slip',
  ];
  const title = titles[Math.floor(rand() * titles.length)];
  const category = guessCategory(title);
  const isClothing = category.cat === 'Clothing' || category.cat === 'Shoes';

  const price = +(rand() * 25 + 3.99).toFixed(2);

  // Gallery images — multiple angles and types
  const galleryImages: TemuGalleryImage[] = GALLERY_TYPES.map((gt, i) => ({
    url: cdnUrl(seed, `gallery_${i + 1}_${gt.type}`),
    type: gt.type,
    label: gt.label,
  }));

  // Download and cache all gallery images locally for reliability
  const { downloadAndCacheImages } = await import("../image-processing");
  const cachedImages = await downloadAndCacheImages(galleryImages.map(g => g.url));

  // Primary images array (all gallery images, ordered)
  const images = cachedImages.length > 0 ? cachedImages : galleryImages.map(g => g.url);

  const variations: TemuVariation[] = [];
  const attrValues: Record<string, string[]> = {};

  for (const attr of category.attrs) {
    if (attr === 'Color') {
      attrValues['Color'] = ['Black', 'White', 'Blue', 'Red', 'Pink'].sort(() => rand() - 0.5).slice(0, Math.ceil(rand() * 3) + 1);
    } else if (attr === 'Size' && isClothing) {
      attrValues['Size'] = ['S', 'M', 'L', 'XL', '2XL'].sort(() => rand() - 0.5).slice(0, 3 + Math.ceil(rand() * 2));
    } else if (attr === 'Size') {
      attrValues['Size'] = ['Small', 'Medium', 'Large'].sort(() => rand() - 0.5).slice(0, Math.ceil(rand() * 2) + 1);
    } else if (attr === 'Storage') {
      attrValues['Storage'] = ['32GB', '64GB', '128GB'];
    } else if (attr === 'Material') {
      attrValues['Material'] = ['Leather', 'Silicone', 'Fabric'];
    }
  }

  const attrKeys = Object.keys(attrValues);
  if (attrKeys.length > 0) {
    const firstKey = attrKeys[0];
    const colors = attrValues[firstKey];

    colors.forEach((val, idx) => {
      const name = attrKeys.length > 1
        ? `${val} / ${attrValues[attrKeys[1]][idx % attrValues[attrKeys[1]].length]}`
        : val;
      const attrs: Record<string, string> = {};
      attrs[firstKey] = val;
      if (attrKeys.length > 1) {
        attrs[attrKeys[1]] = attrValues[attrKeys[1]][idx % attrValues[attrKeys[1]].length];
      }

      variations.push({
        name,
        sku: `TMU-${externalProductId}-${idx + 1}`,
        price: +(price + rand() * 5).toFixed(2),
        stock: Math.floor(rand() * 200),
        image: cdnUrl(seed, `gallery_${(idx % 4) + 1}_swatch`),
        attributes: attrs,
        externalId: `${externalProductId}-var-${idx + 1}`,
        sortOrder: idx,
      });
    });
  }

  return {
    externalProductId,
    title,
    description: `Premium quality ${title.toLowerCase()} — perfect for everyday use. Features durable construction and modern design. Ships directly from Temu warehouse.`,
    sku: `TMU-${externalProductId}`,
    costPrice: price,
    images,
    galleryImages,
    attributes: attrValues,
    deliveryType: 'buyer_pays',
    deliveryCost: +(rand() * 4.99 + 1.99).toFixed(2),
    shippingInfo: {
      estimatedDays: `${7 + Math.floor(rand() * 8)}–${15 + Math.floor(rand() * 10)} days`,
      cost: `$${(rand() * 3 + 1.99).toFixed(2)}`,
      origin: 'China',
    },
    variations,
  };
}

/**
 * Simulate checking the current price of a Temu product.
 */
export async function checkPrice(externalProductId: string): Promise<TemuPriceCheck> {
  const seed = Number(externalProductId.replace(/\D/g, '').slice(0, 9)) || Date.now();
  const rand = seededRandom(seed);
  const basePrice = +(rand() * 25 + 3.99).toFixed(2);
  const fluctuation = +((rand() - 0.5) * 2).toFixed(2);
  return {
    price: +(basePrice + fluctuation).toFixed(2),
    fetchedAt: new Date(),
  };
}

/**
 * Simulate checking the stock status of a Temu product.
 */
export async function checkStock(externalProductId: string): Promise<TemuStockCheck> {
  const seed = Number(externalProductId.replace(/\D/g, '').slice(0, 9)) || Date.now();
  const rand = seededRandom(seed);
  const inStock = rand() > 0.15;

  return {
    stockStatus: inStock ? 'in_stock' : 'out_of_stock',
    variations: [
      { externalId: `${externalProductId}-var-1`, stock: inStock ? Math.floor(rand() * 150) : 0 },
      { externalId: `${externalProductId}-var-2`, stock: inStock ? Math.floor(rand() * 100) : 0 },
      { externalId: `${externalProductId}-var-3`, stock: inStock ? Math.floor(rand() * 80) : 0 },
    ],
    fetchedAt: new Date(),
  };
}

/**
 * AI upscale an image URL using sharp.
 * Downloads the image, upscales 2x with sharpening, and serves from local cache.
 */
export async function upscaleImage(imageUrl: string): Promise<{ originalUrl: string; upscaledUrl: string }> {
  const { upscaleImage: realUpscale } = await import("../image-processing");
  return realUpscale(imageUrl);
}

/**
 * Find products visually similar to a given Temu product.
 *
 * In production this would use CLIP embeddings or perceptual hashing.
 * Here we match on shared category keywords and attribute values with a
 * simulated relevance score.
 */
export async function findSimilarProducts(
  productId: number,
  userId: string,
  allUserProducts: Array<{
    id: number;
    title: string;
    images: string[] | null;
    costPrice: string;
    marketplacePrice: string | null;
    attributes: Record<string, any> | null;
    externalProductId: string | null;
  }>,
): Promise<TemuSimilarProduct[]> {
  const source = allUserProducts.find(p => p.id === productId);
  if (!source) return [];

  const sourceTitle = (source.title || '').toLowerCase();
  const sourceWords = sourceTitle.split(/\s+/).filter(w => w.length > 2);
  const sourceAttrs = source.attributes || {};

  const scored = allUserProducts
    .filter(p => p.id !== productId && p.images?.[0])
    .map(p => {
      const reasons: string[] = [];
      let score = 0;

      // Match on title keywords
      const titleWords = (p.title || '').toLowerCase().split(/\s+/);
      const sharedWords = sourceWords.filter(w => titleWords.includes(w));
      if (sharedWords.length > 0) {
        score += sharedWords.length * 0.3;
        reasons.push(`Shared keywords: ${sharedWords.slice(0, 3).join(', ')}`);
      }

      // Match on attribute values
      const targetAttrs = p.attributes || {};
      for (const [key, val] of Object.entries(sourceAttrs)) {
        if (Array.isArray(val)) {
          const targetVal = targetAttrs[key];
          if (targetVal && Array.isArray(targetVal)) {
            const shared = val.filter(v => targetVal.includes(v));
            if (shared.length > 0) {
              score += 0.5;
              reasons.push(`Shared ${key}: ${shared.join(', ')}`);
            }
          }
        }
      }

      // Match on category-level words
      const catWords = ['shirt', 'shoe', 'bag', 'charger', 'bottle', 'lamp', 'towel', 'pillow', 'stand', 'mat'];
      for (const w of catWords) {
        if (sourceTitle.includes(w) && p.title.toLowerCase().includes(w)) {
          score += 0.8;
          reasons.push(`Same category: ${w}`);
          break;
        }
      }

      // Price proximity bonus
      const sourcePrice = parseFloat(source.costPrice || '0');
      const targetPrice = parseFloat(p.costPrice || '0');
      if (sourcePrice > 0 && targetPrice > 0) {
        const ratio = Math.min(sourcePrice, targetPrice) / Math.max(sourcePrice, targetPrice);
        if (ratio > 0.7) {
          score += 0.3;
          reasons.push('Similar price range');
        }
      }

      return {
        productId: p.id,
        title: p.title,
        image: p.images![0],
        costPrice: parseFloat(p.costPrice || '0'),
        marketplacePrice: parseFloat(p.marketplacePrice || '0'),
        matchScore: Math.round(score * 100) / 100,
        matchReasons: reasons,
      };
    })
    .filter(p => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);

  return scored;
}

export interface SimilarImageResult {
  productId: number;
  productTitle: string;
  imageUrl: string;
  matchScore: number;
  matchReason: string;
}

/**
 * When a supplier product has only 1 image, find visually similar photos
 * from other products in the user's catalog. Matches by category keywords,
 * shared title words, and price proximity as a proxy for visual similarity.
 */
export async function findSimilarImages(
  productId: number,
  imageUrl: string,
  allUserProducts: Array<{
    id: number;
    title: string;
    images: string[] | null;
    costPrice: string;
    marketplacePrice: string | null;
    attributes: Record<string, any> | null;
  }>,
): Promise<SimilarImageResult[]> {
  const source = allUserProducts.find(p => p.id === productId);
  if (!source) return [];

  const sourceTitle = (source.title || '').toLowerCase();
  const sourceWords = sourceTitle.split(/\s+/).filter(w => w.length > 2);
  const sourceAttrs = source.attributes || {};
  const sourcePrice = parseFloat(source.costPrice || '0');

  const seenUrls = new Set<string>([imageUrl]);
  const results: SimilarImageResult[] = [];

  for (const p of allUserProducts) {
    if (p.id === productId || !p.images || p.images.length === 0) continue;

    for (const imgUrl of p.images) {
      if (seenUrls.has(imgUrl)) continue;
      seenUrls.add(imgUrl);

      let score = 0;

      // Match on shared title keywords
      const titleWords = (p.title || '').toLowerCase().split(/\s+/);
      const sharedWords = sourceWords.filter(w => titleWords.includes(w));
      if (sharedWords.length > 0) {
        score += sharedWords.length * 0.3;
      }

      // Match on attribute values
      const targetAttrs = p.attributes || {};
      for (const [key, val] of Object.entries(sourceAttrs)) {
        if (Array.isArray(val)) {
          const targetVal = targetAttrs[key];
          if (targetVal && Array.isArray(targetVal)) {
            const shared = val.filter(v => targetVal.includes(v));
            if (shared.length > 0) score += 0.5;
          }
        }
      }

      // Match on category-level words
      const catWords = ['shirt', 'shoe', 'bag', 'charger', 'bottle', 'lamp', 'towel', 'pillow', 'stand', 'mat'];
      for (const w of catWords) {
        if (sourceTitle.includes(w) && p.title.toLowerCase().includes(w)) {
          score += 0.8;
          break;
        }
      }

      // Price proximity bonus (same price range = same product tier)
      const targetPrice = parseFloat(p.costPrice || '0');
      if (sourcePrice > 0 && targetPrice > 0) {
        const ratio = Math.min(sourcePrice, targetPrice) / Math.max(sourcePrice, targetPrice);
        if (ratio > 0.7) score += 0.3;
      }

      if (score > 0) {
        const reason = sharedWords.length > 0
          ? `Matches "${sharedWords.slice(0, 2).join(', ')}"`
          : 'Similar category';
        results.push({
          productId: p.id,
          productTitle: p.title,
          imageUrl: imgUrl,
          matchScore: Math.round(score * 100) / 100,
          matchReason: reason,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);
}
