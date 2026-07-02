import fs from "fs";
import path from "path";

const CATEGORIES = ["wholesale", "manufacturer", "dropshipper", "distributor", "other"] as const;
const COUNTRIES = [
  "China", "USA", "Germany", "Japan", "India", "Vietnam", "South Korea", "Taiwan",
  "Italy", "UK", "France", "Spain", "Thailand", "Indonesia", "Malaysia", "Turkey",
  "Mexico", "Brazil", "Bangladesh", "Pakistan", "Poland", "Netherlands", "Canada",
  "Portugal", "Hong Kong", "Singapore", "Philippines", "Sri Lanka", "Australia", "UAE"
];
const PAYMENT_TERMS = [
  "Net 30", "Net 60", "Net 15", "PayPal", "Wire Transfer",
  "Letter of Credit", "Net 45", "T/T (Telegraphic Transfer)",
  "PayPal + Net 30", "Credit Card", "Western Union", "Net 90"
];
const LEAD_TIMES = [
  "3-5 days", "5-7 days", "7-10 days", "7-14 days",
  "10-15 days", "14-21 days", "15-30 days", "3-7 days",
  "2-3 weeks", "1-2 weeks", "5-10 days", "7-12 days"
];
const TAGS_POOL = [
  "fast-shipping", "dropship-ready", "private-label", "bulk-discount",
  "certified", "eco-friendly", "premium", "budget-friendly",
  "MOQ-low", "MOQ-high", "sample-available", "custom-packaging",
  "wholesale-only", "retail-ready", "brand-authorised", "express-delivery",
  "global-shipping", "free-samples", "custom-label", "white-label",
  "sustainable", "organic-certified", "quality-assured", "top-rated",
  "verified-supplier", "factory-direct", "new-arrivals", "trending",
  "seasonal-stock", "clearance-stock", "best-seller", "exclusive-deal"
];
const CATEGORY_TAGS: Record<string, string[]> = {
  wholesale: ["bulk-discount", "MOQ-high", "wholesale-only", "factory-direct"],
  manufacturer: ["OEM", "ODM", "private-label", "custom-packaging", "certified"],
  dropshipper: ["dropship-ready", "fast-shipping", "global-shipping", "MOQ-low", "sample-available"],
  distributor: ["brand-authorised", "express-delivery", "top-rated", "verified-supplier"],
  other: ["sample-available", "custom-label", "sustainable"],
};
const CATEGORY_NOTES: Record<string, string[]> = {
  wholesale: [
    "Bulk orders only. Minimum quantities apply. Price breaks available at higher volumes.",
    "Long-standing supplier with consistent quality. Warehouses in Asia and Europe.",
    "Factory-direct pricing. MOQ varies by product line. Samples available on request.",
  ],
  manufacturer: [
    "Factory-direct manufacturer. Full OEM/ODM capabilities. ISO certified.",
    "In-house design team. Custom branding and packaging available.",
    "Advanced manufacturing facility with R&D department. Patent-protected designs.",
  ],
  dropshipper: [
    "Automated dropshipping integration available. Real-time inventory sync.",
    "No minimum order. Worldwide shipping with tracking. Fulfillment within 24 hours.",
    "Dedicated dropshipping platform with API access. Product data feeds available.",
  ],
  distributor: [
    "Authorized distributor for major brands. Full warranty and after-sales support.",
    "Multi-brand distributor with extensive inventory. Same-day dispatch on orders before 2PM.",
    "Official channel partner. Competitive trade pricing. Volume discounts available.",
  ],
  other: [
    "Specialty supplier with unique product range. Flexible terms for long-term partners.",
    "Boutique sourcing partner. Curated product selection. Personal account management.",
    "Hybrid supplier offering both wholesale and dropship options. Adaptable terms.",
  ],
};
const PREFIXES = [
  "Global", "Prime", "Premier", "Elite", "Supreme", "Royal", "Universal", "Pacific",
  "Summit", "Peak", "Vertex", "Apex", "Omega", "Alpha", "Delta", "Metro",
  "Zenith", "Titan", "Atlas", "Nova", "Pro", "Ultra", "Mega", "Orion",
  "Pinnacle", "Essential", "Superior", "Select", "Accent", "Bright"
];
const SUPPLIER_TYPES = [
  "Trading Co.", "Group", "Limited", "Inc.", "Corp.", "Industries", "International",
  "Enterprise", "Holdings", "Ventures", "Supplies", "Corporation", "Company",
  "Trading", "Export", "Sourcing", "Solutions", "Partners", "Worldwide", "Direct"
];
const PRODUCT_NICHES = [
  "Electronics", "Fashion", "Home & Garden", "Beauty & Personal Care",
  "Sports & Outdoors", "Toys & Hobbies", "Pet Supplies", "Automotive",
  "Health & Wellness", "Office Products", "Baby Products", "Jewelry & Accessories",
  "Kitchen & Dining", "Tools & Hardware", "Furniture", "Lighting",
  "Phone Accessories", "Clothing", "Shoes", "Bags & Luggage",
  "Home Decor", "Stationery", "Party Supplies", "Crafts & Sewing",
  "Musical Instruments", "Watches", "Eyewear", "Camping & Hiking"
];

const FIRST_NAMES = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Daniel","Lisa","Matthew","Nancy","Anthony","Betty","Mark","Margaret","Donald","Sandra","Steven","Ashley","Andrew","Emily","Paul","Kimberly","Joshua","Donna","Kenneth","Carol","Kevin","Michelle","Brian","Amanda","George","Melissa","Timothy","Deborah","Ronald","Stephanie","Jason","Dorothy","Jeffrey","Rebecca","Frank","Sharon","Gary","Laura","Ryan","Cynthia","Nicholas","Helen","Eric","Amy","Jacob","Angela","Liam","Anna","Noah","Sophia","Ethan","Isabella","Mason","Mia","Lucas","Charlotte","Wei","Yuki","Raj","Priya","Carlos","Maria","Hiroshi","Yuko","Ahmed","Fatima","Chen","Xia","Jung","Min","Satoshi","Aiko"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Thompson","White","Harris","Clark","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Patel","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Tanaka","Yamamoto","Suzuki","Kim","Park","Choi","Li","Wang","Zhang","Liu","Chen","Yang","Singh","Khan"];

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: readonly T[], n: number): T[] { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function website(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^(?:the|a)\s*/, "").slice(0, 20);
  return `https://www.${slug}${pick([".com", ".net", ".org", ".io", ".co"])}`;
}
function contactName(): string { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
function email(name: string, company: string): string { return `${name.toLowerCase().replace(/\s+/g, ".")}@${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`; }
function randomTags(category: string): string { const base = CATEGORY_TAGS[category] || CATEGORY_TAGS.other; const extras = pickN(TAGS_POOL.filter(t => !base.includes(t)), Math.floor(Math.random() * 4)); return [...base, ...extras].slice(0, 6).join(", "); }

const allNames = PRODUCT_NICHES.flatMap(niche =>
  PREFIXES.slice(0, 20).map(prefix => `${prefix} ${niche} ${pick(SUPPLIER_TYPES)}`)
);
const uniqueNames = [...new Set(allNames)].sort(() => Math.random() - 0.5).slice(0, 530);

const vendors = uniqueNames.map(name => {
  const category = pick(CATEGORIES);
  const country = pick(COUNTRIES);
  const contact = contactName();
  return {
    name,
    website: website(name),
    integrationType: pick(["custom", "api", "feed", "csv"]),
    status: "active",
    contactPerson: contact,
    contactEmail: email(contact, name),
    contactPhone: `+${pick(["1","44","86","91","81","49","33","82","65","39"])} ${pick(["200","300","400","500","600","700","800","900"])} ${String(Math.floor(1000 + Math.random() * 9000))}`,
    category,
    tags: randomTags(category),
    country,
    leadTime: pick(LEAD_TIMES),
    paymentTerms: pick(PAYMENT_TERMS),
    minOrderAmount: pick([null, null, null, "50", "100", "200", "500", "1000", "2500", "5000"]),
    notes: pick(CATEGORY_NOTES[category] || CATEGORY_NOTES.other),
    logo: null,
    config: {},
  };
});

const outPath = path.resolve("vendors-import.json");
fs.writeFileSync(outPath, JSON.stringify({ vendors }, null, 2));
console.log(`Generated ${vendors.length} vendors → ${outPath}`);
