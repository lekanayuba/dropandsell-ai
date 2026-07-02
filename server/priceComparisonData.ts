import { VENDOR_DIRECTORY, getDomain, type DirectoryVendor } from '@shared/vendor-directory';

export interface PriceComparisonProduct {
  id: number;
  title: string;
  category: string;
  platforms: PlatformListing[];
  imageKeyword: string;
  gtin?: string;
}

export interface PlatformListing {
  platform: string;
  seller: string;
  sellerRating: number;
  basePrice: number;
  discount: number;
  shippingCost: number;
  tax: number;
  totalEffectivePrice: number;
  currency: string;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  deliveryDays: number;
  productUrl: string;
}

const BEST_SELLING_PRODUCTS = [
  { title: "CeraVe Moisturising Cream 454g", category: "Health & Beauty", gtin: "3337875597326", imageKeyword: "cerave-cream" },
  { title: "The Ordinary Niacinamide 10% + Zinc 1%", category: "Health & Beauty", gtin: "769915190236", imageKeyword: "ordinary-niacinamide" },
  { title: "Stanley Quencher H2.0 FlowState Tumbler 40oz", category: "Home & Kitchen", gtin: "195437046124", imageKeyword: "stanley-tumbler" },
  { title: "Crocs Classic Clog Unisex", category: "Fashion", gtin: "191448407466", imageKeyword: "crocs" },
  { title: "JBL Go 3 Portable Bluetooth Speaker", category: "Electronics", gtin: "050036379595", imageKeyword: "jbl-go3" },
  { title: "Fire TV Stick Lite with Alexa", category: "Electronics", gtin: "840080585529", imageKeyword: "fire-tv-stick" },
  { title: "Echo Dot 5th Gen Smart Speaker", category: "Smart Home", gtin: "840080577067", imageKeyword: "echo-dot" },
  { title: "COSRX Snail Mucin 96% Essence", category: "Health & Beauty", gtin: "8809416470016", imageKeyword: "cosrx-snail" },
  { title: "Oral-B Vitality Pro Electric Toothbrush", category: "Health & Beauty", gtin: "069055125908", imageKeyword: "oral-b-vitality" },
  { title: "Tower T17021 Family Air Fryer 4.3L", category: "Home & Kitchen", gtin: "5056032942301", imageKeyword: "tower-air-fryer" },
  { title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker", category: "Home & Kitchen", gtin: "810028585324", imageKeyword: "instant-pot" },
  { title: "Anker PowerCore 10000mAh Portable Charger", category: "Electronics", gtin: "848061064858", imageKeyword: "anker-powercore" },
  { title: "TP-Link Tapo Smart Plug Wi-Fi 4-Pack", category: "Smart Home", gtin: "6935364010836", imageKeyword: "tapo-plug" },
  { title: "PlayStation DualSense Wireless Controller", category: "Gaming", gtin: "711719557760", imageKeyword: "dualsense" },
  { title: "Ring Indoor Camera 2nd Gen", category: "Smart Home", gtin: "840080596815", imageKeyword: "ring-indoor" },
  { title: "LEGO Classic Medium Creative Brick Box 10696", category: "Toys & Games", gtin: "5702015357180", imageKeyword: "lego-classic" },
  { title: "Logitech K380 Multi-Device Bluetooth Keyboard", category: "Electronics", gtin: "097855117632", imageKeyword: "logitech-k380" },
  { title: "Samsung EVO Plus 128GB MicroSD Card", category: "Electronics", gtin: "887276731780", imageKeyword: "samsung-evo-sd" },
  { title: "Maybelline Lash Sensational Sky High Mascara", category: "Health & Beauty", gtin: "041554578942", imageKeyword: "maybelline-mascara" },
  { title: "Nespresso Vertuo Pop Coffee Machine", category: "Home & Kitchen", gtin: "7630477999809", imageKeyword: "nespresso-pop" },
  { title: "Philips OneBlade Face + Body QP2630", category: "Health & Beauty", gtin: "8710103877745", imageKeyword: "philips-oneblade" },
  { title: "Squishmallows 12\" Plush Soft Toy", category: "Toys & Games", gtin: "734689500246", imageKeyword: "squishmallows" },
  { title: "Hydro Flask Wide Mouth 32oz", category: "Sports & Outdoors", gtin: "810028842755", imageKeyword: "hydro-flask" },
  { title: "Fitbit Inspire 3 Fitness Tracker", category: "Electronics", gtin: "810124966267", imageKeyword: "fitbit-inspire" },
  { title: "Govee LED Strip Lights 5m RGB", category: "Smart Home", gtin: "810028370616", imageKeyword: "govee-led" },
  { title: "Olaplex No.3 Hair Perfector 100ml", category: "Health & Beauty", gtin: "896364002367", imageKeyword: "olaplex" },
  { title: "BASEUS 20W USB-C Wall Charger 2-Pack", category: "Electronics", gtin: "6953156208476", imageKeyword: "baseus-charger" },
  { title: "Braun Series 3 ProSkin Electric Shaver", category: "Health & Beauty", gtin: "069055875094", imageKeyword: "braun-shaver" },
  { title: "Brita Maxtra Pro Water Filter Cartridges 6-Pack", category: "Home & Kitchen", gtin: "4006387099732", imageKeyword: "brita-maxtra" },
  { title: "Kindle 11th Gen 16GB 6\" Display", category: "Electronics", gtin: "840080582504", imageKeyword: "kindle" },
];

const PLATFORM_TOP_SELLER: Record<string, { name: string; rating: number }> = {
  'Amazon': { name: 'Amazon UK', rating: 4.8 },
  'eBay': { name: 'tech-direct-outlet', rating: 4.9 },
  'Argos': { name: 'Argos Official', rating: 4.7 },
  'Currys': { name: 'Currys', rating: 4.6 },
  'John Lewis': { name: 'John Lewis & Partners', rating: 4.8 },
  'Very': { name: 'Very UK', rating: 4.5 },
  'AO.com': { name: 'AO.com', rating: 4.7 },
  'Boots': { name: 'Boots UK', rating: 4.7 },
  'Superdrug': { name: 'Superdrug', rating: 4.5 },
  'OnBuy': { name: 'OnBuy Marketplace', rating: 4.4 },
  'Robert Dyas': { name: 'Robert Dyas', rating: 4.5 },
  'Richer Sounds': { name: 'Richer Sounds', rating: 4.8 },
  'AliExpress': { name: 'Choice Official Store', rating: 4.7 },
  'Temu': { name: 'Temu Top Seller', rating: 4.5 },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function resolveProductUrl(platform: string, productTitle: string, _gtin?: string): string {
  const encoded = encodeURIComponent(productTitle);
  const platformUrls: Record<string, string> = {
    'Amazon': `https://www.amazon.co.uk/s?k=${encoded}&ref=nb_sb_noss`,
    'eBay': `https://www.ebay.co.uk/sch/i.html?_nkw=${encoded}&_sop=12&LH_BIN=1`,
    'Argos': `https://www.argos.co.uk/search/${encoded.replace(/%20/g, '-').toLowerCase()}/`,
    'Currys': `https://www.currys.co.uk/search/${encoded.replace(/%20/g, '-').toLowerCase()}`,
    'John Lewis': `https://www.johnlewis.com/search?search-term=${encoded}`,
    'Very': `https://www.very.co.uk/search/${encoded.replace(/%20/g, '-').toLowerCase()}`,
    'AO.com': `https://ao.com/search?q=${encoded}`,
    'Boots': `https://www.boots.com/search?q=${encoded}`,
    'Superdrug': `https://www.superdrug.com/search?q=${encoded}`,
    'OnBuy': `https://www.onbuy.com/gb/search/?q=${encoded}`,
    'Robert Dyas': `https://www.robertdyas.co.uk/search?q=${encoded}`,
    'Richer Sounds': `https://www.richersounds.com/search?q=${encoded}`,
    'AliExpress': `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranpro_desc`,
    'Temu': `https://www.temu.com/search_result.html?search_key=${encoded}`,
  };
  return platformUrls[platform] || `https://www.google.co.uk/search?q=${encoded}+buy+${encodeURIComponent(platform)}`;
}

const PLATFORM_CATEGORY_RELEVANCE: Record<string, string[]> = {
  'Amazon': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games', 'Sports & Outdoors'],
  'eBay': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games', 'Sports & Outdoors'],
  'Argos': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Toys & Games', 'Sports & Outdoors'],
  'Currys': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home'],
  'John Lewis': ['Electronics', 'Home & Kitchen', 'Smart Home', 'Health & Beauty', 'Fashion', 'Sports & Outdoors'],
  'Very': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games'],
  'AO.com': ['Electronics', 'Home & Kitchen', 'Smart Home'],
  'Boots': ['Health & Beauty', 'Electronics', 'Smart Home'],
  'Superdrug': ['Health & Beauty'],
  'OnBuy': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games'],
  'Robert Dyas': ['Home & Kitchen', 'Smart Home'],
  'Richer Sounds': ['Electronics'],
  'AliExpress': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games', 'Sports & Outdoors'],
  'Temu': ['Electronics', 'Home & Kitchen', 'Gaming', 'Smart Home', 'Health & Beauty', 'Fashion', 'Toys & Games', 'Sports & Outdoors'],
};

function generateListingsForProduct(product: { title: string; category: string; gtin?: string }, index: number, weekSeed: number): PlatformListing[] {
  const rand = seededRandom(weekSeed + index * 7919);
  const listings: PlatformListing[] = [];
  const platformKeys = Object.keys(PLATFORM_TOP_SELLER);

  const basePriceMap: Record<string, number> = {
    "Electronics": 15 + rand() * 40,
    "Home & Kitchen": 15 + rand() * 35,
    "Gaming": 25 + rand() * 30,
    "Smart Home": 15 + rand() * 25,
    "Health & Beauty": 5 + rand() * 30,
    "Fashion": 15 + rand() * 30,
    "Toys & Games": 10 + rand() * 20,
    "Sports & Outdoors": 15 + rand() * 30,
  };
  const basePrice = basePriceMap[product.category] || (10 + rand() * 30);

  for (const platform of platformKeys) {
    const relevantCategories = PLATFORM_CATEGORY_RELEVANCE[platform] || [];
    if (!relevantCategories.includes(product.category)) {
      continue;
    }

    const seller = PLATFORM_TOP_SELLER[platform];
    const priceVariation = 0.85 + rand() * 0.35;
    let price = Math.round(basePrice * priceVariation * 100) / 100;

    if (platform === 'AliExpress' || platform === 'Temu') {
      price = Math.round(price * 0.65 * 100) / 100;
    } else if (platform === 'John Lewis') {
      price = Math.round(price * 1.05 * 100) / 100;
    } else if (platform === 'Richer Sounds') {
      price = Math.round(price * 0.97 * 100) / 100;
    }

    const discountChance = rand();
    const discount = discountChance > 0.6 ? Math.round(price * (0.03 + rand() * 0.15) * 100) / 100 : 0;

    const shippingMap: Record<string, number[]> = {
      'Amazon': [0, 0, 0, 0, 2.99],
      'eBay': [0, 0, 2.99, 3.99, 4.99],
      'Argos': [0, 0, 3.95],
      'Currys': [0, 0, 0],
      'John Lewis': [0, 0, 0],
      'Very': [0, 0, 3.99],
      'AO.com': [0, 0, 0],
      'Boots': [0, 0, 3.50],
      'Superdrug': [0, 0, 3.00],
      'OnBuy': [0, 2.99, 3.99, 4.99],
      'Robert Dyas': [0, 0, 3.95],
      'Richer Sounds': [0, 0, 0],
      'AliExpress': [0, 0, 0, 2.99, 3.99],
      'Temu': [0, 0, 0, 2.99],
    };
    const shippingOptions = shippingMap[platform] || [0, 2.99, 3.99];
    const shippingCost = shippingOptions[Math.floor(rand() * shippingOptions.length)];

    const noVatPlatforms = ['AliExpress', 'Temu'];
    const taxRate = noVatPlatforms.includes(platform) ? 0 : 0.2;
    const priceAfterDiscount = price - discount;
    const tax = Math.round(priceAfterDiscount * taxRate * 100) / 100;
    const tep = Math.round((priceAfterDiscount + shippingCost + tax) * 100) / 100;

    const availabilityRoll = rand();
    const availability: 'in_stock' | 'low_stock' | 'out_of_stock' =
      availabilityRoll > 0.15 ? 'in_stock' : availabilityRoll > 0.05 ? 'low_stock' : 'out_of_stock';

    const deliveryMap: Record<string, number[]> = {
      'Amazon': [1, 1, 2, 2, 3],
      'eBay': [2, 3, 3, 4, 5],
      'Argos': [1, 1, 2, 3],
      'Currys': [1, 2, 3, 5],
      'John Lewis': [2, 3, 3, 5],
      'Very': [3, 3, 5, 7],
      'AO.com': [1, 2, 3],
      'Boots': [2, 3, 5],
      'Superdrug': [2, 3, 5],
      'OnBuy': [3, 4, 5, 7],
      'Robert Dyas': [2, 3, 5],
      'Richer Sounds': [1, 2, 3, 5],
      'AliExpress': [7, 10, 12, 15, 20],
      'Temu': [5, 7, 8, 10, 12],
    };
    const deliveryOptions = deliveryMap[platform] || [3, 5, 7];
    const deliveryDays = deliveryOptions[Math.floor(rand() * deliveryOptions.length)];

    listings.push({
      platform,
      seller: seller.name,
      sellerRating: seller.rating,
      basePrice: price,
      discount,
      shippingCost,
      tax,
      totalEffectivePrice: tep,
      currency: 'GBP',
      availability,
      deliveryDays,
      productUrl: resolveProductUrl(platform, product.title, product.gtin),
    });
  }

  listings.sort((a, b) => a.totalEffectivePrice - b.totalEffectivePrice);
  return listings;
}

export function generatePriceComparisonData(): PriceComparisonProduct[] {
  const now = new Date();
  const weekNumber = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const weekSeed = weekNumber * 31337;

  return BEST_SELLING_PRODUCTS.map((product, index) => {
    const listings = generateListingsForProduct(product, index, weekSeed);
    return {
      id: index + 1,
      title: product.title,
      category: product.category,
      platforms: listings,
      imageKeyword: product.imageKeyword,
      gtin: product.gtin,
    };
  });
}

// =====================================================================
// Directory-driven global price comparison search
// =====================================================================

export interface SearchPlatformResult {
  platform: string;
  /** Primary "buy" link — Google Shopping search restricted to this vendor + country.
   *  Returns real product cards that link directly to the vendor's product page. */
  searchUrl: string;
  /** Direct on-site vendor search — secondary "Browse on vendor" link. */
  vendorSearchUrl: string;
  seller: string;
  sellerRating: number;
  estimatedDeliveryDays: number;
  currency: string;
  countryCode: string;
  countryName: string;
  category: string;
  description: string;
  domain: string;
  faviconUrl: string;
  hasDirectSearch: boolean;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  currency: string;
  vendorCount: number;
  categories: { name: string; count: number }[];
}

// Country metadata: flag emoji + currency + delivery profile
const COUNTRY_META: Record<string, { flag: string; currency: string; baseDelivery: number[] }> = {
  'UK':           { flag: '🇬🇧', currency: 'GBP', baseDelivery: [1, 2, 3, 5] },
  'USA':          { flag: '🇺🇸', currency: 'USD', baseDelivery: [1, 2, 3, 5] },
  'Canada':       { flag: '🇨🇦', currency: 'CAD', baseDelivery: [2, 3, 4, 5] },
  'Australia':    { flag: '🇦🇺', currency: 'AUD', baseDelivery: [2, 3, 5, 7] },
  'Germany':      { flag: '🇩🇪', currency: 'EUR', baseDelivery: [1, 2, 3, 5] },
  'France':       { flag: '🇫🇷', currency: 'EUR', baseDelivery: [1, 2, 3, 5] },
  'Spain':        { flag: '🇪🇸', currency: 'EUR', baseDelivery: [1, 2, 3, 5] },
  'Italy':        { flag: '🇮🇹', currency: 'EUR', baseDelivery: [1, 2, 3, 5] },
  'Netherlands':  { flag: '🇳🇱', currency: 'EUR', baseDelivery: [1, 2, 3, 5] },
  'Sweden':       { flag: '🇸🇪', currency: 'SEK', baseDelivery: [2, 3, 4, 5] },
  'Poland':       { flag: '🇵🇱', currency: 'PLN', baseDelivery: [2, 3, 4, 5] },
  'Turkey':       { flag: '🇹🇷', currency: 'TRY', baseDelivery: [2, 3, 4, 5] },
  'India':        { flag: '🇮🇳', currency: 'INR', baseDelivery: [2, 3, 5, 7] },
  'China':        { flag: '🇨🇳', currency: 'CNY', baseDelivery: [3, 5, 7, 10] },
  'Japan':        { flag: '🇯🇵', currency: 'JPY', baseDelivery: [1, 2, 3, 5] },
  'South Korea':  { flag: '🇰🇷', currency: 'KRW', baseDelivery: [1, 2, 3, 5] },
  'Brazil':       { flag: '🇧🇷', currency: 'BRL', baseDelivery: [3, 5, 7, 10] },
  'Mexico':       { flag: '🇲🇽', currency: 'MXN', baseDelivery: [2, 3, 5, 7] },
  'Nigeria':      { flag: '🇳🇬', currency: 'NGN', baseDelivery: [3, 5, 7, 10] },
  'South Africa': { flag: '🇿🇦', currency: 'ZAR', baseDelivery: [2, 3, 5, 7] },
  'Kenya':        { flag: '🇰🇪', currency: 'KES', baseDelivery: [3, 5, 7, 10] },
  'Ghana':        { flag: '🇬🇭', currency: 'GHS', baseDelivery: [3, 5, 7, 10] },
  'Egypt':        { flag: '🇪🇬', currency: 'EGP', baseDelivery: [3, 5, 7, 10] },
  'UAE':          { flag: '🇦🇪', currency: 'AED', baseDelivery: [2, 3, 5, 7] },
  'Saudi Arabia': { flag: '🇸🇦', currency: 'SAR', baseDelivery: [2, 3, 5, 7] },
};

// Map country names to ISO-style codes used in the API
const COUNTRY_CODE_FROM_NAME: Record<string, string> = {
  'UK': 'GB', 'USA': 'US', 'Canada': 'CA', 'Australia': 'AU',
  'Germany': 'DE', 'France': 'FR', 'Spain': 'ES', 'Italy': 'IT',
  'Netherlands': 'NL', 'Sweden': 'SE', 'Poland': 'PL', 'Turkey': 'TR',
  'India': 'IN', 'China': 'CN', 'Japan': 'JP', 'South Korea': 'KR',
  'Brazil': 'BR', 'Mexico': 'MX', 'Nigeria': 'NG', 'South Africa': 'ZA',
  'Kenya': 'KE', 'Ghana': 'GH', 'Egypt': 'EG', 'UAE': 'AE',
  'Saudi Arabia': 'SA',
};
const COUNTRY_NAME_FROM_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CODE_FROM_NAME).map(([n, c]) => [c, n])
);

// Known direct search URL patterns keyed by domain (or substring match).
// These produce a real on-site search result page. For everything else we
// fall back to a Google `site:domain.com {query}` search which always works.
const DIRECT_SEARCH_PATTERNS: { match: (domain: string, website: string) => boolean; build: (domain: string, q: string, website: string) => string }[] = [
  // Noon — uses locale path (e.g. /uae-en, /saudi-en, /egypt-en)
  { match: (_d, w) => /noon\.com\//i.test(w + '/'), build: (_d, q, w) => {
      const m = w.match(/noon\.com\/([a-z-]+)/i);
      const locale = m ? m[1] : 'uae-en';
      return `https://www.noon.com/${locale}/search/?q=${q}`;
    } },
  // Amazon (all locales)
  { match: d => /(^|\.)amazon\./i.test(d), build: (d, q) => `https://${d}/s?k=${q}` },
  // eBay (all locales)
  { match: d => /(^|\.)ebay\./i.test(d), build: (d, q) => `https://${d}/sch/i.html?_nkw=${q}&_sop=12&LH_BIN=1` },
  // Walmart variants
  { match: d => /walmart\./i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  // Target
  { match: d => d === 'www.target.com' || d === 'target.com', build: (d, q) => `https://${d}/s?searchTerm=${q}` },
  // Best Buy
  { match: d => /bestbuy\./i.test(d), build: (d, q) => `https://${d}/site/searchpage.jsp?st=${q}` },
  // Home Depot
  { match: d => /homedepot\./i.test(d), build: (d, q) => `https://${d}/s/${q}` },
  // Lowes
  { match: d => /lowes\./i.test(d), build: (d, q) => `https://${d}/search?searchTerm=${q}` },
  // Costco
  { match: d => /costco\./i.test(d), build: (d, q) => `https://${d}/CatalogSearch?keyword=${q}` },
  // Argos
  { match: d => d.includes('argos.co.uk'), build: (d, q) => `https://${d}/search/${q}/` },
  // Currys
  { match: d => d.includes('currys.co.uk'), build: (d, q) => `https://${d}/search?q=${q}` },
  // John Lewis
  { match: d => d.includes('johnlewis.com'), build: (d, q) => `https://${d}/search?search-term=${q}` },
  // Very
  { match: d => d.includes('very.co.uk'), build: (d, q) => `https://${d}/search/${q}` },
  // AO.com
  { match: d => d === 'www.ao.com' || d === 'ao.com', build: (d, q) => `https://${d}/search?q=${q}` },
  // Boots / Superdrug
  { match: d => /(boots|superdrug)\.com/i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  // OnBuy
  { match: d => d.includes('onbuy.com'), build: (d, q) => `https://${d}/gb/search/?q=${q}` },
  // ASOS / Boohoo / PrettyLittleThing / Missguided / Next / Asda George
  { match: d => /(asos|boohoo|prettylittlething|missguided|riverisland|newlook|primark|matalan|tkmaxx|marksandspencer|next\.co\.uk|hm\.com|zara\.com|matalan)/i.test(d), build: (d, q) => `https://${d}/search/?q=${q}` },
  // Dunelm / Habitat / Wayfair / Wickes / B&Q (diy.com) / Robert Dyas / Homebase / Wilko
  { match: d => /(dunelm|habitat|wayfair|wickes|diy\.com|robertdyas|homebase|wilko)/i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  // Tesco / Sainsbury's / Asda / Morrisons
  { match: d => /(tesco|sainsburys|asda|morrisons)\.com|sainsburys\.co\.uk/i.test(d), build: (d, q) => `https://${d}/groceries/en-GB/search?query=${q}` },
  // German retailers
  { match: d => /otto\.de/i.test(d), build: (d, q) => `https://${d}/suche/${q}/` },
  { match: d => /(mediamarkt|saturn)\.de/i.test(d), build: (d, q) => `https://${d}/de/search.html?query=${q}` },
  { match: d => /zalando\./i.test(d), build: (d, q) => `https://${d}/catalog/?q=${q}` },
  { match: d => /lidl\.de/i.test(d), build: (d, q) => `https://${d}/q/query/${q}` },
  { match: d => /kaufland\.de/i.test(d), build: (d, q) => `https://${d}/s/?search_value=${q}` },
  { match: d => /notebooksbilliger\.de/i.test(d), build: (d, q) => `https://${d}/produkte/${q}` },
  { match: d => /conrad\.de/i.test(d), build: (d, q) => `https://${d}/de/search.html?search=${q}` },
  // French retailers
  { match: d => /cdiscount\.com/i.test(d), build: (d, q) => `https://${d}/search/10/${q}.html` },
  { match: d => /fnac\.(com|es)/i.test(d), build: (d, q) => `https://${d}/SearchResult/ResultList.aspx?Search=${q}` },
  { match: d => /darty\.com/i.test(d), build: (d, q) => `https://${d}/nav/recherche?text=${q}` },
  { match: d => /boulanger\.com/i.test(d), build: (d, q) => `https://${d}/resultats?tr=${q}` },
  { match: d => /laredoute\./i.test(d), build: (d, q) => `https://${d}/ppdp/${q}.aspx` },
  { match: d => /rakuten\.(com|co\.jp)|fr\.shopping\.rakuten\.com/i.test(d), build: (d, q) => `https://${d}/search/${q}` },
  { match: d => /carrefour\./i.test(d), build: (d, q) => `https://${d}/s?q=${q}` },
  { match: d => /leroymerlin\./i.test(d), build: (d, q) => `https://${d}/v3/search/search.do?keyword=${q}` },
  // Spain
  { match: d => /elcorteingles\./i.test(d), build: (d, q) => `https://${d}/search/?s=${q}` },
  { match: d => /pccomponentes\./i.test(d), build: (d, q) => `https://${d}/buscar/?query=${q}` },
  { match: d => /worten\./i.test(d), build: (d, q) => `https://${d}/search?query=${q}` },
  // Italy
  { match: d => /eprice\./i.test(d), build: (d, q) => `https://${d}/search/${q}` },
  { match: d => /unieuro\./i.test(d), build: (d, q) => `https://${d}/online/search?text=${q}` },
  { match: d => /mediaworld\./i.test(d), build: (d, q) => `https://${d}/it/search.html?query=${q}` },
  // Netherlands
  { match: d => /bol\.com/i.test(d), build: (d, q) => `https://${d}/nl/nl/s/?searchtext=${q}` },
  { match: d => /coolblue\./i.test(d), build: (d, q) => `https://${d}/zoeken?query=${q}` },
  { match: d => /wehkamp\./i.test(d), build: (d, q) => `https://${d}/search/?text=${q}` },
  // Japan
  { match: d => /search\.rakuten\.co\.jp|rakuten\.co\.jp/i.test(d), build: (d, q) => `https://search.rakuten.co.jp/search/mall/${q}/` },
  { match: d => /shopping\.yahoo\.co\.jp/i.test(d), build: (d, q) => `https://shopping.yahoo.co.jp/search?p=${q}` },
  { match: d => /mercari\./i.test(d), build: (d, q) => `https://${d}/search?keyword=${q}` },
  { match: d => /yodobashi\./i.test(d), build: (d, q) => `https://${d}/?word=${q}` },
  { match: d => /biccamera\./i.test(d), build: (d, q) => `https://${d}/bc/category/?q=${q}` },
  // China
  { match: d => /aliexpress\./i.test(d), build: (d, q) => `https://${d}/wholesale?SearchText=${q}&SortType=total_tranpro_desc` },
  { match: d => /alibaba\.com/i.test(d), build: (d, q) => `https://${d}/trade/search?SearchText=${q}` },
  { match: d => /taobao\./i.test(d), build: (d, q) => `https://s.taobao.com/search?q=${q}` },
  { match: d => /tmall\./i.test(d), build: (d, q) => `https://list.tmall.com/search_product.htm?q=${q}` },
  { match: d => /jd\.com/i.test(d), build: (d, q) => `https://search.jd.com/Search?keyword=${q}&enc=utf-8` },
  { match: d => /dhgate\./i.test(d), build: (d, q) => `https://${d}/wholesale/search.do?searchkey=${q}` },
  { match: d => /banggood\./i.test(d), build: (d, q) => `https://${d}/search/${q}.html` },
  { match: d => /temu\./i.test(d), build: (d, q) => `https://${d}/search_result.html?search_key=${q}` },
  { match: d => /cjdropshipping\./i.test(d), build: (d, q) => `https://${d}/search.html?searchKey=${q}` },
  // India
  { match: d => /flipkart\./i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  { match: d => /meesho\./i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  { match: d => /snapdeal\./i.test(d), build: (d, q) => `https://${d}/search?keyword=${q}` },
  { match: d => /myntra\./i.test(d), build: (d, q) => `https://${d}/${q}` },
  { match: d => /ajio\./i.test(d), build: (d, q) => `https://${d}/search/?text=${q}` },
  { match: d => /tatacliq\./i.test(d), build: (d, q) => `https://${d}/search/?searchCategory=all&text=${q}` },
  { match: d => /jiomart\./i.test(d), build: (d, q) => `https://${d}/search/${q}` },
  { match: d => /reliancedigital\./i.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
  { match: d => /croma\./i.test(d), build: (d, q) => `https://${d}/search/?text=${q}` },
  // Brazil / Mexico — MercadoLivre/MercadoLibre uses lista.<root> for search
  { match: d => /mercadolivre\.com\.br|mercadolibre\.com\.mx/i.test(d), build: (d, q) => {
      // Strip leading subdomains like www. or lista. and prepend lista.
      const root = d.replace(/^(www\.|lista\.)/, '');
      return `https://lista.${root}/${q}`;
    } },
  { match: d => /magazineluiza\./i.test(d), build: (d, q) => `https://${d}/busca/${q}/` },
  { match: d => /americanas\./i.test(d), build: (d, q) => `https://${d}/busca/${q}` },
  { match: d => /casasbahia\./i.test(d), build: (d, q) => `https://${d}/${q}/b` },
  { match: d => /shopee\./i.test(d), build: (d, q) => `https://${d}/search?keyword=${q}` },
  // Mexico
  { match: d => /liverpool\.com\.mx/i.test(d), build: (d, q) => `https://${d}/tienda/?s=${q}` },
  { match: d => /coppel\./i.test(d), build: (d, q) => `https://${d}/buscar/?q=${q}` },
  // Africa
  { match: d => /jumia\./i.test(d), build: (d, q) => `https://${d}/catalog/?q=${q}` },
  { match: d => /konga\./i.test(d), build: (d, q) => `https://${d}/search?search=${q}` },
  { match: d => /takealot\./i.test(d), build: (d, q) => `https://${d}/all?qsearch=${q}` },
  { match: d => /makro\.co\.za/i.test(d), build: (d, q) => `https://${d}/search/?q=${q}` },
  { match: d => /loot\.co\.za/i.test(d), build: (d, q) => `https://${d}/search?cat=all&offset=0&keyword=${q}` },
  { match: d => /bidorbuy\./i.test(d), build: (d, q) => `https://${d}/jsp/search/SearchResults.jsp?keyword=${q}` },
  { match: d => /kilimall\./i.test(d), build: (d, q) => `https://${d}/new/commodity-search?val=${q}` },
  // Middle East
  { match: d => /noon\.com/i.test(d), build: (d, q) => `https://${d}/uae-en/search/?q=${q}` },
  { match: d => /sharafdg\./i.test(d), build: (d, q) => `https://${d}/?s=${q}` },
  { match: d => /luluhypermarket\./i.test(d), build: (d, q) => `https://${d}/en-ae/search/?q=${q}` },
  { match: d => /jarir\./i.test(d), build: (d, q) => `https://${d}/sa-en/catalogsearch/result/?q=${q}` },
  { match: d => /extra\.com/i.test(d), build: (d, q) => `https://${d}/en-sa/search?text=${q}` },
  { match: d => /namshi\./i.test(d), build: (d, q) => `https://${d}/catalog/?q=${q}` },
  // SEA
  { match: d => /lazada\./i.test(d), build: (d, q) => `https://${d}/catalog/?q=${q}` },
  { match: d => /qoo10\./i.test(d), build: (d, q) => `https://${d}/gmkt.inc/Search/Search.aspx?keyword=${q}` },
  // Generic Shopify / WooCommerce / Magento fallbacks (very common search params)
  { match: d => /\.com$|\.co\.uk$|\.co$|\.net$/.test(d), build: (d, q) => `https://${d}/search?q=${q}` },
];

// Google Shopping country codes (gl=) by our country name.
const GOOGLE_SHOPPING_GL: Record<string, string> = {
  'UK': 'uk', 'USA': 'us', 'Canada': 'ca', 'Australia': 'au',
  'Germany': 'de', 'France': 'fr', 'Spain': 'es', 'Italy': 'it',
  'Netherlands': 'nl', 'Sweden': 'se', 'Poland': 'pl', 'Turkey': 'tr',
  'India': 'in', 'China': 'cn', 'Japan': 'jp', 'South Korea': 'kr',
  'Brazil': 'br', 'Mexico': 'mx', 'Nigeria': 'ng', 'South Africa': 'za',
  'Kenya': 'ke', 'Ghana': 'gh', 'Egypt': 'eg', 'UAE': 'ae',
  'Saudi Arabia': 'sa',
};

/**
 * Google Shopping search restricted by vendor name + country.
 * This is the PRIMARY product-page link. Google Shopping returns real product
 * cards with current prices for the queried product at the named vendor;
 * clicking a card lands the user on the actual product page on the vendor's
 * site (one click from checkout). It is the closest we can get to a direct
 * "buy" link without ingesting each vendor's product feed.
 */
function buildShoppingUrl(vendorName: string, query: string, countryName: string): string {
  const gl = GOOGLE_SHOPPING_GL[countryName] || 'us';
  const q = encodeURIComponent(`${query} ${vendorName}`);
  return `https://www.google.com/search?tbm=shop&gl=${gl}&q=${q}`;
}

/**
 * Vendor's own on-site search (or Google site: fallback).
 * Used as a SECONDARY "Browse vendor" link. Direct on the vendor's domain
 * but lands on a search page, not a product page — which is why we no longer
 * surface it as the primary action.
 */
function buildVendorSearchUrl(website: string, query: string): { url: string; direct: boolean } {
  const domain = getDomain(website);
  const encoded = encodeURIComponent(query);
  for (let i = 0; i < DIRECT_SEARCH_PATTERNS.length - 1; i++) {
    const p = DIRECT_SEARCH_PATTERNS[i];
    try {
      if (p.match(domain, website)) {
        return { url: p.build(domain, encoded, website), direct: true };
      }
    } catch {
      // ignore matcher errors and continue
    }
  }
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`,
    direct: false,
  };
}

// Precompute country -> vendors index
let _countryIndex: Record<string, DirectoryVendor[]> | null = null;
function getCountryIndex(): Record<string, DirectoryVendor[]> {
  if (_countryIndex) return _countryIndex;
  const idx: Record<string, DirectoryVendor[]> = {};
  for (const v of VENDOR_DIRECTORY) {
    if (!idx[v.country]) idx[v.country] = [];
    idx[v.country].push(v);
  }
  _countryIndex = idx;
  return idx;
}

export function getSupportedCountries(): CountryOption[] {
  const idx = getCountryIndex();
  const options: CountryOption[] = [];
  for (const country of Object.keys(idx).sort()) {
    const meta = COUNTRY_META[country];
    const vendors = idx[country];
    const code = COUNTRY_CODE_FROM_NAME[country] || country.slice(0, 2).toUpperCase();
    const catCounts: Record<string, number> = {};
    for (const v of vendors) {
      catCounts[v.category] = (catCounts[v.category] || 0) + 1;
    }
    const categories = Object.entries(catCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    options.push({
      code,
      name: country,
      flag: meta?.flag || '🏳️',
      currency: meta?.currency || 'USD',
      vendorCount: vendors.length,
      categories,
    });
  }
  return options;
}

function estimateRating(name: string, country: string): number {
  // Stable per-vendor pseudo rating between 4.0 and 4.9
  const seed = (name + country).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = seededRandom(seed);
  return Math.round((4.0 + r() * 0.9) * 10) / 10;
}

export function generateSearchComparison(
  query: string,
  countryCode: string = 'GB',
  category: string = 'all',
  limit: number = 200,
): { resolvedCountry: string; resolvedCategory: string; results: SearchPlatformResult[]; totalAvailable: number } {
  const upper = (countryCode || 'GB').toUpperCase();
  const requestedName = COUNTRY_NAME_FROM_CODE[upper];
  const idx = getCountryIndex();
  const resolvedName = (requestedName && idx[requestedName]) ? requestedName : 'UK';
  const resolvedCode = COUNTRY_CODE_FROM_NAME[resolvedName] || 'GB';
  const meta = COUNTRY_META[resolvedName] || { flag: '🏳️', currency: 'USD', baseDelivery: [3, 5, 7] };

  let vendors = idx[resolvedName] || [];
  const cat = (category || 'all').trim();
  const resolvedCategory = cat && cat.toLowerCase() !== 'all' ? cat : 'all';
  if (resolvedCategory !== 'all') {
    const lc = resolvedCategory.toLowerCase();
    vendors = vendors.filter(v => v.category.toLowerCase() === lc);
  }

  const totalAvailable = vendors.length;
  const sliced = vendors.slice(0, Math.max(1, Math.min(limit, 500)));

  const seed = (query + resolvedCode).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const results: SearchPlatformResult[] = sliced.map(v => {
    const shoppingUrl = buildShoppingUrl(v.name, query, resolvedName);
    const { url: vendorUrl, direct } = buildVendorSearchUrl(v.website, query);
    const domain = getDomain(v.website);
    const deliveryDays = meta.baseDelivery[Math.floor(rand() * meta.baseDelivery.length)];
    return {
      platform: v.name,
      searchUrl: shoppingUrl,
      vendorSearchUrl: vendorUrl,
      seller: v.name,
      sellerRating: estimateRating(v.name, resolvedName),
      estimatedDeliveryDays: deliveryDays,
      currency: meta.currency,
      countryCode: resolvedCode,
      countryName: resolvedName,
      category: v.category,
      description: v.description,
      domain,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      hasDirectSearch: direct,
    };
  });

  // Vendors with direct-search support first (better UX)
  results.sort((a, b) => {
    if (a.hasDirectSearch !== b.hasDirectSearch) return a.hasDirectSearch ? -1 : 1;
    return a.platform.localeCompare(b.platform);
  });

  return { resolvedCountry: resolvedCode, resolvedCategory, results, totalAvailable };
}
