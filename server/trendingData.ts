export interface TrendingProductSeed {
  platform: string;
  title: string;
  category: string;
  price: string;
  salesVolume: number;
  rank: number;
  productUrl?: string;
  vendorName?: string;
  vendorRating?: string;
  vendorReviews?: number;
  vendorReliability?: string;
}

interface VendorProfile {
  name: string;
  rating: number;
  reviews: number;
  reliability: 'excellent' | 'very_good' | 'good';
}

const PLATFORM_TOP_VENDORS: Record<string, VendorProfile[]> = {
  'Amazon': [
    { name: 'Amazon UK', rating: 4.8, reviews: 2450000, reliability: 'excellent' },
    { name: 'TechDirect UK', rating: 4.7, reviews: 189400, reliability: 'excellent' },
    { name: 'HomeEssentials Ltd', rating: 4.6, reviews: 134200, reliability: 'very_good' },
    { name: 'GadgetHub Pro', rating: 4.7, reviews: 98700, reliability: 'excellent' },
    { name: 'PrimeChoice Store', rating: 4.5, reviews: 76300, reliability: 'very_good' },
  ],
  'eBay': [
    { name: 'tech-direct-outlet', rating: 4.9, reviews: 342100, reliability: 'excellent' },
    { name: 'gadgets_warehouse_uk', rating: 4.8, reviews: 267800, reliability: 'excellent' },
    { name: 'fashion-hub-official', rating: 4.7, reviews: 198400, reliability: 'very_good' },
    { name: 'premium_deals_uk', rating: 4.8, reviews: 156200, reliability: 'excellent' },
    { name: 'bestbuy-electronics', rating: 4.6, reviews: 134500, reliability: 'very_good' },
  ],
  'Shopify': [
    { name: 'Official Brand Store', rating: 4.8, reviews: 45200, reliability: 'excellent' },
    { name: 'Direct Brand Site', rating: 4.7, reviews: 38900, reliability: 'excellent' },
    { name: 'Verified Merchant', rating: 4.6, reviews: 28400, reliability: 'very_good' },
  ],
  'Walmart': [
    { name: 'Walmart.com', rating: 4.7, reviews: 1890000, reliability: 'excellent' },
    { name: 'Walmart Marketplace Pro', rating: 4.5, reviews: 67800, reliability: 'very_good' },
  ],
  'CJ Dropshipping': [
    { name: 'CJ Official Warehouse', rating: 4.8, reviews: 412300, reliability: 'excellent' },
    { name: 'CJ UK Fulfilment', rating: 4.7, reviews: 198400, reliability: 'excellent' },
    { name: 'CJ Trending Hub', rating: 4.6, reviews: 142800, reliability: 'very_good' },
  ],
  'Costco': [
    { name: 'Costco UK', rating: 4.8, reviews: 286400, reliability: 'excellent' },
    { name: 'Costco Wholesale Online', rating: 4.7, reviews: 174200, reliability: 'excellent' },
  ],
  'Home Bargains': [
    { name: 'Home Bargains Online', rating: 4.7, reviews: 142800, reliability: 'excellent' },
    { name: 'Home Bargains Store Direct', rating: 4.6, reviews: 96400, reliability: 'very_good' },
  ],
};

function resolveDirectProductUrl(platform: string, title: string): string {
  const encoded = encodeURIComponent(title);

  const platformUrls: Record<string, string> = {
    'Amazon': `https://www.amazon.co.uk/s?k=${encoded}&ref=nb_sb_noss`,
    'eBay': `https://www.ebay.co.uk/sch/i.html?_nkw=${encoded}&_sop=12&LH_BIN=1`,
    'Shopify': `https://www.google.co.uk/search?q=${encoded}+official+store+buy`,
    'Walmart': `https://www.walmart.com/search?q=${encoded}&sort=best_seller`,
    'CJ Dropshipping': `https://www.cjdropshipping.com/list/search?searchKey=${encoded}`,
    'Costco': `https://www.costco.co.uk/search?text=${encoded}`,
    'Home Bargains': `https://www.homebargains.co.uk/search?q=${encoded}`,
    'TikTok Shop': `https://shop.tiktok.com/search?q=${encoded}`,
    'Temu': `https://www.temu.com/search_result.html?search_key=${encoded}`,
    'Shein': `https://www.shein.co.uk/pdsearch/${encoded}/`,
  };
  return platformUrls[platform] || `https://www.google.co.uk/search?q=${encoded}+buy+${encodeURIComponent(platform)}`;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateWeeklyProducts(): TrendingProductSeed[] {
  const now = new Date();
  const weekSeed = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000)) * 31337;
  const rand = seededRandom(weekSeed);

  return BASE_TRENDING_PRODUCTS.map((p) => {
    const vendors = PLATFORM_TOP_VENDORS[p.platform] || PLATFORM_TOP_VENDORS['Amazon'];
    const vendor = vendors[Math.floor(rand() * vendors.length)];

    const volumeVariation = 0.85 + rand() * 0.3;
    const adjustedVolume = Math.round(p.salesVolume * volumeVariation);

    return {
      ...p,
      salesVolume: adjustedVolume,
      // Respect a hard-coded direct product URL on the seed (so trending items
      // link straight to the seller's product detail page, ready for the
      // browser extension's one-click import). Fall back to the search URL
      // only if the seed didn't supply one.
      productUrl: p.productUrl || resolveDirectProductUrl(p.platform, p.title),
      vendorName: p.vendorName || vendor.name,
      vendorRating: p.vendorRating || vendor.rating.toFixed(1),
      vendorReviews: p.vendorReviews || (vendor.reviews + Math.round(rand() * 5000)),
      vendorReliability: p.vendorReliability || vendor.reliability,
    };
  });
}

export const BASE_TRENDING_PRODUCTS: TrendingProductSeed[] = [
  { platform: "Amazon", title: "CeraVe Moisturising Cream 454g", category: "Health & Beauty", price: "14.40", salesVolume: 62800, rank: 1 },
  { platform: "Amazon", title: "The Ordinary Niacinamide 10% + Zinc 1% 30ml", category: "Health & Beauty", price: "5.80", salesVolume: 58200, rank: 2 },
  { platform: "Amazon", title: "Amazon Basics AA Rechargeable Batteries 8-Pack", category: "Electronics", price: "10.99", salesVolume: 55400, rank: 3 },
  { platform: "Amazon", title: "Anker USB-C to Lightning Cable 2-Pack 1.8m", category: "Electronics", price: "13.99", salesVolume: 52100, rank: 4 },
  { platform: "Amazon", title: "Fire TV Stick Lite with Alexa Voice Remote", category: "Electronics", price: "29.99", salesVolume: 49800, rank: 5 },
  { platform: "Amazon", title: "Echo Dot 5th Gen Smart Speaker", category: "Smart Home", price: "24.99", salesVolume: 47200, rank: 6 },
  { platform: "Amazon", title: "COSRX Snail Mucin 96% Essence 100ml", category: "Health & Beauty", price: "12.99", salesVolume: 45600, rank: 7 },
  { platform: "Amazon", title: "Duracell Plus AA Alkaline Batteries 12-Pack", category: "Electronics", price: "7.99", salesVolume: 43800, rank: 8 },
  { platform: "Amazon", title: "JBL Go 3 Portable Bluetooth Speaker", category: "Electronics", price: "29.99", salesVolume: 41200, rank: 9 },
  { platform: "Amazon", title: "TP-Link Tapo Smart Plug Wi-Fi 4-Pack", category: "Smart Home", price: "24.99", salesVolume: 39600, rank: 10 },
  { platform: "Amazon", title: "Crocs Classic Clog Unisex Adults", category: "Fashion", price: "34.99", salesVolume: 38100, rank: 11 },
  { platform: "Amazon", title: "Stanley Quencher H2.0 FlowState Tumbler 40oz", category: "Home & Kitchen", price: "35.00", salesVolume: 36800, rank: 12 },
  { platform: "Amazon", title: "Maybelline Lash Sensational Sky High Mascara", category: "Health & Beauty", price: "9.99", salesVolume: 35400, rank: 13 },
  { platform: "Amazon", title: "LEGO Classic Medium Creative Brick Box 10696", category: "Toys & Games", price: "19.99", salesVolume: 34200, rank: 14 },
  { platform: "Amazon", title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker 5.7L", category: "Home & Kitchen", price: "49.99", salesVolume: 32800, rank: 15 },
  { platform: "Amazon", title: "Anker PowerCore 10000mAh Portable Charger", category: "Electronics", price: "19.99", salesVolume: 31600, rank: 16 },
  { platform: "Amazon", title: "Oral-B Vitality Pro Electric Toothbrush", category: "Health & Beauty", price: "24.99", salesVolume: 30200, rank: 17 },
  { platform: "Amazon", title: "Ring Indoor Camera 2nd Gen", category: "Smart Home", price: "34.99", salesVolume: 29100, rank: 18 },
  { platform: "Amazon", title: "Tower T17021 Family Size Air Fryer 4.3L", category: "Home & Kitchen", price: "44.99", salesVolume: 28400, rank: 19 },
  { platform: "Amazon", title: "Nescafé Dolce Gusto Genio S Touch Coffee Machine", category: "Home & Kitchen", price: "49.99", salesVolume: 27200, rank: 20 },
  { platform: "Amazon", title: "Google Nest Mini 2nd Gen Smart Speaker", category: "Smart Home", price: "29.00", salesVolume: 26100, rank: 21 },
  { platform: "Amazon", title: "Logitech K380 Multi-Device Bluetooth Keyboard", category: "Electronics", price: "34.99", salesVolume: 25400, rank: 22 },
  { platform: "Amazon", title: "Hydro Flask Wide Mouth 32oz Water Bottle", category: "Sports & Outdoors", price: "32.95", salesVolume: 24800, rank: 23 },
  { platform: "Amazon", title: "Yankee Candle Large Jar Vanilla Cupcake", category: "Home & Kitchen", price: "19.99", salesVolume: 23600, rank: 24 },
  { platform: "Amazon", title: "PlayStation DualSense Wireless Controller", category: "Gaming", price: "44.99", salesVolume: 22400, rank: 25 },
  { platform: "Amazon", title: "Philips OneBlade Face + Body QP2630", category: "Health & Beauty", price: "34.99", salesVolume: 21800, rank: 26 },
  { platform: "Amazon", title: "BASEUS 20W USB-C Charger 2-Pack", category: "Electronics", price: "9.99", salesVolume: 21200, rank: 27 },
  { platform: "Amazon", title: "Silentnight Airmax Breathable Pillow", category: "Home & Kitchen", price: "12.00", salesVolume: 20600, rank: 28 },
  { platform: "Amazon", title: "Fairy Platinum Plus All-in-One Dishwasher Tabs 60pk", category: "Home & Kitchen", price: "14.99", salesVolume: 19800, rank: 29 },
  { platform: "Amazon", title: "Samsung EVO Plus 128GB MicroSD Card", category: "Electronics", price: "11.99", salesVolume: 19200, rank: 30 },
  { platform: "Amazon", title: "Nivea Soft Moisturising Cream 200ml", category: "Health & Beauty", price: "3.50", salesVolume: 18600, rank: 31 },
  { platform: "Amazon", title: "Logitech M185 Wireless Mouse", category: "Electronics", price: "9.99", salesVolume: 18100, rank: 32 },
  { platform: "Amazon", title: "Squishmallows 12\" Plush Soft Toy", category: "Toys & Games", price: "14.99", salesVolume: 17600, rank: 33 },
  { platform: "Amazon", title: "Neutrogena Hydro Boost Water Gel Moisturiser", category: "Health & Beauty", price: "11.99", salesVolume: 17200, rank: 34 },
  { platform: "Amazon", title: "Nespresso Vertuo Pop Coffee Machine", category: "Home & Kitchen", price: "49.00", salesVolume: 16800, rank: 35 },
  { platform: "Amazon", title: "Amazon Basics HDMI Cable 2m 4K", category: "Electronics", price: "6.99", salesVolume: 16200, rank: 36 },
  { platform: "Amazon", title: "Pukka Organic Tea Selection Box 45 Bags", category: "Food & Drink", price: "8.99", salesVolume: 15800, rank: 37 },
  { platform: "Amazon", title: "Bosch IXO 7th Gen Cordless Screwdriver", category: "Home & Garden", price: "39.99", salesVolume: 15200, rank: 38 },
  { platform: "Amazon", title: "Kindle 11th Gen 16GB 6\" Display", category: "Electronics", price: "49.99", salesVolume: 14800, rank: 39 },
  { platform: "Amazon", title: "Olaplex No.3 Hair Perfector Treatment 100ml", category: "Health & Beauty", price: "22.00", salesVolume: 14200, rank: 40 },
  { platform: "Amazon", title: "Cosori Air Fryer 3.8L", category: "Home & Kitchen", price: "49.99", salesVolume: 13800, rank: 41 },
  { platform: "Amazon", title: "Fitbit Inspire 3 Fitness Tracker", category: "Electronics", price: "49.99", salesVolume: 13400, rank: 42 },
  { platform: "Amazon", title: "Gorilla Grip Original Shower Mat", category: "Home & Kitchen", price: "12.99", salesVolume: 12800, rank: 43 },
  { platform: "Amazon", title: "Braun Series 3 ProSkin Electric Shaver", category: "Health & Beauty", price: "44.99", salesVolume: 12400, rank: 44 },
  { platform: "Amazon", title: "Govee LED Strip Lights 5m RGB", category: "Smart Home", price: "12.99", salesVolume: 12000, rank: 45 },
  { platform: "Amazon", title: "Brita Maxtra Pro Water Filter Cartridges 6-Pack", category: "Home & Kitchen", price: "24.99", salesVolume: 11600, rank: 46 },
  { platform: "Amazon", title: "Energizer Max AAA Batteries 24-Pack", category: "Electronics", price: "9.99", salesVolume: 11200, rank: 47 },
  { platform: "Amazon", title: "L'Oréal Paris Elvive Dream Lengths Shampoo 400ml", category: "Health & Beauty", price: "4.50", salesVolume: 10800, rank: 48 },
  { platform: "Amazon", title: "Amazon Basics USB-C to USB-A Cable 2-Pack", category: "Electronics", price: "7.49", salesVolume: 10400, rank: 49 },
  { platform: "Amazon", title: "Moleskine Classic Notebook A5 Hardcover", category: "Stationery", price: "14.99", salesVolume: 10000, rank: 50 },

  { platform: "eBay", title: "Nike Air Force 1 '07 Triple White Men's Trainers", category: "Fashion", price: "44.99", salesVolume: 48200, rank: 1 },
  { platform: "eBay", title: "Samsung Galaxy Buds FE Wireless Earbuds", category: "Electronics", price: "39.99", salesVolume: 42600, rank: 2 },
  { platform: "eBay", title: "Pokémon TCG Booster Packs Bundle x10", category: "Collectibles", price: "29.99", salesVolume: 38900, rank: 3 },
  { platform: "eBay", title: "Adidas Samba OG Trainers White Gum", category: "Fashion", price: "49.99", salesVolume: 36400, rank: 4 },
  { platform: "eBay", title: "Apple AirPods 3rd Generation with Case", category: "Electronics", price: "49.99", salesVolume: 34800, rank: 5 },
  { platform: "eBay", title: "Stanley 1.18L Quencher H2.0 Tumbler", category: "Home & Kitchen", price: "29.99", salesVolume: 33200, rank: 6 },
  { platform: "eBay", title: "Crocs Classic Clog Unisex All Colours", category: "Fashion", price: "24.99", salesVolume: 31800, rank: 7 },
  { platform: "eBay", title: "New Balance 327 Trainers", category: "Fashion", price: "44.99", salesVolume: 29600, rank: 8 },
  { platform: "eBay", title: "Pandora Moments Snake Chain Bracelet Silver", category: "Jewellery & Watches", price: "39.00", salesVolume: 28400, rank: 9 },
  { platform: "eBay", title: "PS5 DualSense Wireless Controller", category: "Gaming", price: "39.99", salesVolume: 27200, rank: 10 },
  { platform: "eBay", title: "Casio F-91W Classic Digital Watch", category: "Jewellery & Watches", price: "12.99", salesVolume: 26100, rank: 11 },
  { platform: "eBay", title: "Dr Martens 1461 Smooth Leather Shoes Black", category: "Fashion", price: "49.99", salesVolume: 25000, rank: 12 },
  { platform: "eBay", title: "JBL Clip 4 Portable Bluetooth Speaker", category: "Electronics", price: "34.99", salesVolume: 24200, rank: 13 },
  { platform: "eBay", title: "Vans Old Skool Classic Trainers", category: "Fashion", price: "34.99", salesVolume: 23400, rank: 14 },
  { platform: "eBay", title: "Nintendo Switch Joy-Con Controllers Pair", category: "Gaming", price: "49.99", salesVolume: 22100, rank: 15 },
  { platform: "eBay", title: "Samsung EVO Plus 256GB MicroSD Card", category: "Electronics", price: "18.99", salesVolume: 21400, rank: 16 },
  { platform: "eBay", title: "Converse Chuck Taylor All Star Low White", category: "Fashion", price: "29.99", salesVolume: 20800, rank: 17 },
  { platform: "eBay", title: "Anker Soundcore Life Q30 Headphones", category: "Electronics", price: "44.99", salesVolume: 19600, rank: 18 },
  { platform: "eBay", title: "Puma RS-X Trainers", category: "Fashion", price: "39.99", salesVolume: 18400, rank: 19 },
  { platform: "eBay", title: "GHD Original Hair Straightener", category: "Health & Beauty", price: "49.99", salesVolume: 17800, rank: 20 },
  { platform: "eBay", title: "Reebok Classic Leather Trainers White", category: "Fashion", price: "34.99", salesVolume: 17200, rank: 21 },
  { platform: "eBay", title: "Beats Flex Wireless Bluetooth Earphones", category: "Electronics", price: "39.99", salesVolume: 16600, rank: 22 },
  { platform: "eBay", title: "Ray-Ban New Wayfarer Sunglasses", category: "Fashion", price: "49.99", salesVolume: 16000, rank: 23 },
  { platform: "eBay", title: "Titleist Pro V1 Golf Balls Dozen", category: "Sports & Outdoors", price: "42.99", salesVolume: 15400, rank: 24 },
  { platform: "eBay", title: "Tommy Hilfiger Logo T-Shirt Men's", category: "Fashion", price: "24.99", salesVolume: 14800, rank: 25 },
  { platform: "eBay", title: "Swatch New Gent Watch", category: "Jewellery & Watches", price: "44.99", salesVolume: 14200, rank: 26 },
  { platform: "eBay", title: "Osprey Daylite 13L Backpack", category: "Travel", price: "35.00", salesVolume: 13800, rank: 27 },
  { platform: "eBay", title: "Under Armour Tech 2.0 T-Shirt Men's", category: "Fashion", price: "19.99", salesVolume: 13200, rank: 28 },
  { platform: "eBay", title: "Herschel Supply Pop Quiz Backpack", category: "Travel", price: "44.99", salesVolume: 12800, rank: 29 },
  { platform: "eBay", title: "Havaianas Brasil Logo Flip Flops", category: "Fashion", price: "14.99", salesVolume: 12200, rank: 30 },
  { platform: "eBay", title: "Calvin Klein Eternity EDT 100ml", category: "Health & Beauty", price: "29.99", salesVolume: 11800, rank: 31 },
  { platform: "eBay", title: "LEGO Speed Champions 2 Fast 2 Furious Skyline", category: "Toys & Games", price: "19.99", salesVolume: 11400, rank: 32 },
  { platform: "eBay", title: "Karrimor Mount Low Walking Shoes", category: "Fashion", price: "29.99", salesVolume: 10800, rank: 33 },
  { platform: "eBay", title: "Superdry Vintage Logo T-Shirt", category: "Fashion", price: "19.99", salesVolume: 10400, rank: 34 },
  { platform: "eBay", title: "Amazon Fire TV Stick 4K", category: "Electronics", price: "34.99", salesVolume: 10000, rank: 35 },
  { platform: "eBay", title: "Brabantia 30L Pedal Bin Matt Steel", category: "Home & Kitchen", price: "44.99", salesVolume: 9600, rank: 36 },
  { platform: "eBay", title: "Sony WF-C500 True Wireless Earbuds", category: "Electronics", price: "39.99", salesVolume: 9200, rank: 37 },
  { platform: "eBay", title: "Levi's 501 Original Fit Jeans Men's", category: "Fashion", price: "49.99", salesVolume: 8800, rank: 38 },
  { platform: "eBay", title: "Canon PIXMA TS3350 Wireless Printer", category: "Electronics", price: "34.99", salesVolume: 8400, rank: 39 },
  { platform: "eBay", title: "Yankee Candle Large Jar Clean Cotton", category: "Home & Kitchen", price: "16.99", salesVolume: 8000, rank: 40 },
  { platform: "eBay", title: "Asics Gel-Contend 8 Running Shoes", category: "Fashion", price: "39.99", salesVolume: 7600, rank: 41 },
  { platform: "eBay", title: "L'Oréal Paris True Match Foundation", category: "Health & Beauty", price: "9.99", salesVolume: 7200, rank: 42 },
  { platform: "eBay", title: "Seagate Portable 2TB External Hard Drive", category: "Electronics", price: "44.99", salesVolume: 6800, rank: 43 },
  { platform: "eBay", title: "Jack & Jones Originals T-Shirt 3-Pack", category: "Fashion", price: "24.99", salesVolume: 6400, rank: 44 },
  { platform: "eBay", title: "Bodum Chambord French Press 1L", category: "Home & Kitchen", price: "24.99", salesVolume: 6000, rank: 45 },
  { platform: "eBay", title: "TP-Link TL-SG108 8-Port Gigabit Switch", category: "Electronics", price: "18.99", salesVolume: 5600, rank: 46 },
  { platform: "eBay", title: "Lacoste Polo Shirt Classic Fit", category: "Fashion", price: "44.99", salesVolume: 5200, rank: 47 },
  { platform: "eBay", title: "Philips Hue White E27 Smart Bulb 2-Pack", category: "Smart Home", price: "19.99", salesVolume: 4800, rank: 48 },
  { platform: "eBay", title: "Fjällräven Kånken Mini Backpack", category: "Fashion", price: "44.99", salesVolume: 4400, rank: 49 },
  { platform: "eBay", title: "SanDisk Ultra 64GB USB 3.0 Flash Drive", category: "Electronics", price: "7.99", salesVolume: 4000, rank: 50 },

  { platform: "Shopify", title: "The Ordinary Niacinamide 10% + Zinc 1%", category: "Health & Beauty", price: "5.80", salesVolume: 52100, rank: 1 },
  { platform: "Shopify", title: "Parade Universal High Rise Thong", category: "Fashion", price: "9.00", salesVolume: 48200, rank: 2 },
  { platform: "Shopify", title: "Native Deodorant Coconut & Vanilla", category: "Health & Beauty", price: "13.97", salesVolume: 42600, rank: 3 },
  { platform: "Shopify", title: "Glossier Boy Brow Eyebrow Gel", category: "Health & Beauty", price: "18.00", salesVolume: 38400, rank: 4 },
  { platform: "Shopify", title: "Gymshark Vital Seamless 2.0 Leggings", category: "Fashion", price: "28.00", salesVolume: 36800, rank: 5 },
  { platform: "Shopify", title: "Olaplex No.3 Hair Perfector Treatment", category: "Health & Beauty", price: "22.00", salesVolume: 34200, rank: 6 },
  { platform: "Shopify", title: "Huel Daily Greens Powder 30 Servings", category: "Health & Beauty", price: "26.00", salesVolume: 31800, rank: 7 },
  { platform: "Shopify", title: "True Classic Crew Neck T-Shirt 3-Pack", category: "Fashion", price: "39.99", salesVolume: 29600, rank: 8 },
  { platform: "Shopify", title: "Charlotte Tilbury Pillow Talk Lipstick", category: "Health & Beauty", price: "27.00", salesVolume: 28400, rank: 9 },
  { platform: "Shopify", title: "Myprotein Impact Whey Protein 1kg", category: "Health & Beauty", price: "18.99", salesVolume: 27200, rank: 10 },
  { platform: "Shopify", title: "Beardbrand Utility Oil Tree Ranger 30ml", category: "Health & Beauty", price: "25.00", salesVolume: 25100, rank: 11 },
  { platform: "Shopify", title: "Frank Green Ceramic Reusable Cup 295ml", category: "Home & Kitchen", price: "29.95", salesVolume: 24200, rank: 12 },
  { platform: "Shopify", title: "Hydro Flask Standard Mouth 21oz", category: "Sports & Outdoors", price: "29.95", salesVolume: 23400, rank: 13 },
  { platform: "Shopify", title: "MATE. The Label Organic Crew Tee", category: "Fashion", price: "28.00", salesVolume: 22100, rank: 14 },
  { platform: "Shopify", title: "Bombas Ankle Socks 3-Pack", category: "Fashion", price: "32.80", salesVolume: 21200, rank: 15 },
  { platform: "Shopify", title: "Richer Poorer Classic Ankle Socks 3-Pack", category: "Fashion", price: "22.00", salesVolume: 19800, rank: 16 },
  { platform: "Shopify", title: "Marine Layer Relaxed Crew Neck T-Shirt", category: "Fashion", price: "32.00", salesVolume: 18600, rank: 17 },
  { platform: "Shopify", title: "Olipop Vintage Cola 12-Pack", category: "Food & Drink", price: "29.88", salesVolume: 17400, rank: 18 },
  { platform: "Shopify", title: "Quince Mongolian Cashmere Crewneck Sweater", category: "Fashion", price: "50.00", salesVolume: 16200, rank: 19 },
  { platform: "Shopify", title: "Vuori Kore Short 7\"", category: "Fashion", price: "48.00", salesVolume: 15400, rank: 20 },
  { platform: "Shopify", title: "Cariuma IBI Low Knit Sneakers", category: "Fashion", price: "49.00", salesVolume: 14600, rank: 21 },
  { platform: "Shopify", title: "Kylie Cosmetics Lip Kit Matte Liquid", category: "Health & Beauty", price: "29.00", salesVolume: 13800, rank: 22 },
  { platform: "Shopify", title: "Huel Black Edition Protein Powder 1kg", category: "Health & Beauty", price: "22.50", salesVolume: 13200, rank: 23 },
  { platform: "Shopify", title: "Mejuri Bold Chain Necklace Gold Vermeil", category: "Jewellery & Watches", price: "48.00", salesVolume: 12400, rank: 24 },
  { platform: "Shopify", title: "Brooklinen Classic Core Sheet Set", category: "Home & Kitchen", price: "49.00", salesVolume: 11800, rank: 25 },
  { platform: "Shopify", title: "Ridge Wallet Aluminium Card Holder", category: "Accessories", price: "45.00", salesVolume: 11200, rank: 26 },
  { platform: "Shopify", title: "Outdoor Voices Exercise Dress", category: "Fashion", price: "48.00", salesVolume: 10600, rank: 27 },
  { platform: "Shopify", title: "Aesop Resurrection Aromatique Hand Wash 500ml", category: "Health & Beauty", price: "27.00", salesVolume: 10000, rank: 28 },
  { platform: "Shopify", title: "Allbirds Wool Runners", category: "Fashion", price: "49.00", salesVolume: 9400, rank: 29 },
  { platform: "Shopify", title: "Warby Parker Felix Sunglasses", category: "Accessories", price: "45.00", salesVolume: 8800, rank: 30 },
  { platform: "Shopify", title: "MVMT Classic Watch 40mm", category: "Jewellery & Watches", price: "48.00", salesVolume: 8400, rank: 31 },
  { platform: "Shopify", title: "Chubbies The Everywear Shorts 5.5\"", category: "Fashion", price: "39.50", salesVolume: 7800, rank: 32 },
  { platform: "Shopify", title: "Glossier Cloud Paint Blush", category: "Health & Beauty", price: "20.00", salesVolume: 7400, rank: 33 },
  { platform: "Shopify", title: "Represent Owners Club T-Shirt", category: "Fashion", price: "45.00", salesVolume: 6800, rank: 34 },
  { platform: "Shopify", title: "Skims Cotton Jersey T-Shirt", category: "Fashion", price: "38.00", salesVolume: 6400, rank: 35 },
  { platform: "Shopify", title: "Native Body Wash Coconut & Vanilla", category: "Health & Beauty", price: "9.97", salesVolume: 6000, rank: 36 },
  { platform: "Shopify", title: "Ruggable Washable Rug Runner 2.5x7 ft", category: "Home & Kitchen", price: "49.00", salesVolume: 5600, rank: 37 },
  { platform: "Shopify", title: "Caraway Ceramic Fry Pan 10\"", category: "Home & Kitchen", price: "45.00", salesVolume: 5200, rank: 38 },
  { platform: "Shopify", title: "Rothy's The Flat Shoes", category: "Fashion", price: "49.00", salesVolume: 4800, rank: 39 },
  { platform: "Shopify", title: "Fellow Carter Move Travel Mug 12oz", category: "Home & Kitchen", price: "28.00", salesVolume: 4400, rank: 40 },
  { platform: "Shopify", title: "Lululemon Align Tank Top", category: "Fashion", price: "48.00", salesVolume: 4000, rank: 41 },
  { platform: "Shopify", title: "On Cloud 5 Running Shoes", category: "Fashion", price: "49.99", salesVolume: 3800, rank: 42 },
  { platform: "Shopify", title: "Parade Re:Play Bralette", category: "Fashion", price: "22.00", salesVolume: 3400, rank: 43 },
  { platform: "Shopify", title: "Brooklinen Super-Plush Bath Towels Pair", category: "Home & Kitchen", price: "49.00", salesVolume: 3200, rank: 44 },
  { platform: "Shopify", title: "Veja Esplar Trainers White", category: "Fashion", price: "45.00", salesVolume: 3000, rank: 45 },
  { platform: "Shopify", title: "True Classic V-Neck T-Shirt", category: "Fashion", price: "25.00", salesVolume: 2800, rank: 46 },
  { platform: "Shopify", title: "Glossier Milky Jelly Cleanser", category: "Health & Beauty", price: "20.00", salesVolume: 2600, rank: 47 },
  { platform: "Shopify", title: "Bombas Gripper Slipper", category: "Fashion", price: "34.00", salesVolume: 2400, rank: 48 },
  { platform: "Shopify", title: "Quince Organic Cotton Hoodie", category: "Fashion", price: "35.00", salesVolume: 2200, rank: 49 },
  { platform: "Shopify", title: "Huel Ready-to-Drink Meal 6-Pack", category: "Food & Drink", price: "18.00", salesVolume: 2000, rank: 50 },

  { platform: "CJ Dropshipping", title: "Portable Mini Handheld Fan USB Rechargeable", category: "Electronics", price: "5.99", salesVolume: 86200, rank: 1, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Pet Hair Remover Roller Reusable", category: "Pet Supplies", price: "7.49", salesVolume: 74600, rank: 2, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "LED Strip Lights 5m RGB with Remote", category: "Smart Home", price: "8.99", salesVolume: 68400, rank: 3, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Magnetic Phone Car Mount 360 Rotation", category: "Accessories", price: "4.99", salesVolume: 62100, rank: 4, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Silicone Stretch Lids Set of 6", category: "Home & Kitchen", price: "6.49", salesVolume: 56400, rank: 5, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Wireless Doorbell with 52 Chimes Waterproof", category: "Smart Home", price: "9.99", salesVolume: 51800, rank: 6, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Foldable Yoga Mat Non-Slip 6mm", category: "Sports & Outdoors", price: "12.99", salesVolume: 47200, rank: 7, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Wireless Earbuds Bluetooth 5.3 with Charging Case", category: "Electronics", price: "11.99", salesVolume: 43600, rank: 8, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Reusable Silicone Food Storage Bags Set of 4", category: "Home & Kitchen", price: "8.99", salesVolume: 39800, rank: 9, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Smart LED Sunset Projector Lamp", category: "Home Décor", price: "13.99", salesVolume: 36200, rank: 10, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Multifunctional Vegetable Slicer 12-in-1", category: "Home & Kitchen", price: "14.99", salesVolume: 33400, rank: 11, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Posture Corrector Back Support Brace", category: "Health & Beauty", price: "9.99", salesVolume: 30800, rank: 12, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "USB Heated Mug Coaster with Auto Shutoff", category: "Home & Kitchen", price: "7.99", salesVolume: 28200, rank: 13, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Portable Mini Sealing Machine for Snack Bags", category: "Home & Kitchen", price: "6.99", salesVolume: 26100, rank: 14, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },
  { platform: "CJ Dropshipping", title: "Self-Stirring Coffee Mug Electric", category: "Home & Kitchen", price: "8.49", salesVolume: 23800, rank: 15, productUrl: "https://www.cjdropshipping.com/list/winning-products.html" },

  { platform: "Costco", title: "Kirkland Signature Italian Extra Virgin Olive Oil 2L", category: "Food & Drink", price: "12.99", salesVolume: 78400, rank: 1, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Charmin Ultra Soft Toilet Paper 30 Rolls", category: "Household", price: "29.99", salesVolume: 72100, rank: 2, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Kirkland Signature Premium Drinking Water 35-Pack", category: "Food & Drink", price: "9.99", salesVolume: 65800, rank: 3, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Vitamix A2500 Ascent Series Blender", category: "Home & Kitchen", price: "499.99", salesVolume: 42100, rank: 4, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Bose QuietComfort 45 Wireless Headphones", category: "Electronics", price: "229.99", salesVolume: 38400, rank: 5, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Kirkland Signature Multivitamin Adults 365 Tablets", category: "Health & Beauty", price: "14.99", salesVolume: 36200, rank: 6, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "iRobot Roomba i7+ Self-Emptying Robot Vacuum", category: "Smart Home", price: "599.99", salesVolume: 28400, rank: 7, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Stanley Quencher H2.0 FlowState Tumbler 40oz 4-Pack", category: "Home & Kitchen", price: "89.99", salesVolume: 26100, rank: 8, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Kirkland Signature Bath Tissue 2-Ply 30 Rolls", category: "Household", price: "21.99", salesVolume: 24800, rank: 9, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Cuisinart 14-Cup Food Processor", category: "Home & Kitchen", price: "199.99", salesVolume: 22600, rank: 10, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Tide Pods HE Laundry Detergent 152-Count", category: "Household", price: "29.99", salesVolume: 21400, rank: 11, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Apple AirPods Pro 2nd Generation USB-C", category: "Electronics", price: "199.99", salesVolume: 19800, rank: 12, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Kirkland Signature Toasted Coconut Almonds 1kg", category: "Food & Drink", price: "12.99", salesVolume: 18200, rank: 13, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Dyson V11 Animal Cordless Vacuum Cleaner", category: "Home & Kitchen", price: "449.99", salesVolume: 16400, rank: 14, productUrl: "https://www.costco.co.uk/best-sellers" },
  { platform: "Costco", title: "Le Creuset Signature Round Casserole 24cm", category: "Home & Kitchen", price: "229.99", salesVolume: 14200, rank: 15, productUrl: "https://www.costco.co.uk/best-sellers" },

  { platform: "Home Bargains", title: "Tower Air Fryer 4.3L Family Size Black", category: "Home & Kitchen", price: "44.99", salesVolume: 92400, rank: 1, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Yankee Candle Large Jar Vanilla Cupcake", category: "Home Décor", price: "12.99", salesVolume: 84600, rank: 2, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Fairy Platinum Plus Dishwasher Tabs 60-Pack", category: "Household", price: "9.99", salesVolume: 78200, rank: 3, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Lenor Outdoorable Fabric Conditioner 1L", category: "Household", price: "3.99", salesVolume: 72400, rank: 4, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Cadbury Dairy Milk Chocolate Bar 360g", category: "Food & Drink", price: "3.99", salesVolume: 68800, rank: 5, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Russell Hobbs Glass Kettle Illuminating", category: "Home & Kitchen", price: "24.99", salesVolume: 54200, rank: 6, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Salter Stainless Steel Bathroom Scale Digital", category: "Health & Beauty", price: "12.99", salesVolume: 48400, rank: 7, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Glade Aromatherapy Pure Essential Oils Diffuser", category: "Home Décor", price: "5.99", salesVolume: 45100, rank: 8, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Pringles Original Crisps 200g 5-Pack", category: "Food & Drink", price: "5.99", salesVolume: 42800, rank: 9, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Cif All-Purpose Cleaning Wipes 100-Pack", category: "Household", price: "2.99", salesVolume: 39600, rank: 10, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Beldray 1.5L Cordless Steam Iron", category: "Home & Kitchen", price: "14.99", salesVolume: 36400, rank: 11, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Garnier Micellar Cleansing Water 700ml", category: "Health & Beauty", price: "4.99", salesVolume: 33200, rank: 12, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Persil Bio Washing Liquid 85 Wash", category: "Household", price: "12.99", salesVolume: 30800, rank: 13, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Nescafe Gold Blend Instant Coffee 200g", category: "Food & Drink", price: "6.99", salesVolume: 28100, rank: 14, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
  { platform: "Home Bargains", title: "Brabantia Touch Bin 30L Stainless Steel", category: "Home & Kitchen", price: "39.99", salesVolume: 25400, rank: 15, productUrl: "https://www.homebargains.co.uk/categories/home-bargains-bestsellers" },
];
