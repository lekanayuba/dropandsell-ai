import { db } from "../server/db";
import { vendors } from "../shared/schema";
import { sql } from "drizzle-orm";

const CATEGORIES = ["wholesale","manufacturer","dropshipper","distributor","other"] as const;
const COUNTRIES = ["China","USA","Germany","Japan","India","Vietnam","South Korea","Taiwan","Italy","UK","France","Spain","Thailand","Indonesia","Malaysia","Turkey","Mexico","Brazil","Bangladesh","Pakistan","Poland","Netherlands","Canada","Portugal","Hong Kong","Singapore","Philippines","Sri Lanka","Australia","UAE"];
const PAYMENT_TERMS = ["Net 30","Net 60","Net 15","PayPal","Wire Transfer","Letter of Credit","Net 45","T/T","PayPal + Net 30","Credit Card","Western Union","Net 90"];
const LEAD_TIMES = ["3-5 days","5-7 days","7-10 days","7-14 days","10-15 days","14-21 days","15-30 days","3-7 days","2-3 weeks","1-2 weeks","5-10 days","7-12 days"];
const TAGS_POOL = ["fast-shipping","dropship-ready","private-label","bulk-discount","certified","eco-friendly","premium","MOQ-low","MOQ-high","sample-available","custom-packaging","wholesale-only","retail-ready","global-shipping","free-samples","white-label","organic-certified","quality-assured","verified-supplier","factory-direct"];
const CATEGORY_TAGS: Record<string,string[]> = { wholesale:["bulk-discount","MOQ-high","wholesale-only","factory-direct"], manufacturer:["private-label","custom-packaging","certified"], dropshipper:["dropship-ready","fast-shipping","global-shipping","MOQ-low","sample-available"], distributor:["retail-ready","verified-supplier"], other:["sample-available","white-label"] };
const NOTES: Record<string,string[]> = { wholesale:["Bulk orders only. MOQ applies.","Factory-direct pricing. Samples available.","Long-standing supplier with consistent quality."], manufacturer:["Full OEM/ODM capabilities. ISO certified.","In-house design team. Custom packaging available."], dropshipper:["Automated dropshipping. No minimum order.","Worldwide shipping with tracking. Fulfillment within 24h."], distributor:["Authorized distributor for major brands.","Multi-brand distributor. Same-day dispatch."], other:["Specialty supplier. Flexible terms.","Curated product selection. Personal account manager."] };
const PREFIXES = ["Global","Prime","Premier","Elite","Supreme","Royal","Universal","Pacific","Summit","Peak","Vertex","Apex","Omega","Alpha","Delta","Metro","Zenith","Titan","Atlas","Nova"];
const TYPES = ["Trading Co.","Group","Limited","Inc.","Corp.","Industries","International","Enterprise","Holdings","Supplies","Company","Sourcing","Solutions","Partners","Direct"];
const NICHES = ["Electronics","Fashion","Home & Garden","Beauty & Personal Care","Sports & Outdoors","Toys & Hobbies","Pet Supplies","Automotive","Health & Wellness","Office Products","Baby Products","Jewelry & Accessories","Kitchen & Dining","Tools & Hardware","Furniture","Lighting","Phone Accessories","Clothing","Shoes","Bags & Luggage","Home Decor","Stationery","Party Supplies","Crafts & Sewing","Watches","Eyewear","Camping & Hiking"];
const FIRST = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Daniel","Lisa","Matthew","Nancy","Anthony","Betty","Mark","Margaret","Donald","Sandra","Steven","Ashley","Andrew","Emily","Paul","Joshua","Donna","Kenneth","Carol","Kevin","Michelle","Brian","Amanda","George","Melissa","Timothy","Deborah","Ronald","Stephanie","Jason","Dorothy","Jeffrey","Rebecca","Frank","Sharon","Gary","Laura","Ryan","Cynthia","Nicholas","Helen","Eric","Amy","Jacob","Angela","Liam","Anna","Noah","Sophia","Ethan","Isabella","Mason","Mia","Lucas","Charlotte","Wei","Yuki","Raj","Priya","Carlos","Maria","Hiroshi","Yuko","Ahmed","Fatima","Chen","Xia","Jung","Min","Satoshi","Aiko"];
const LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Thompson","White","Harris","Clark","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Patel","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Tanaka","Yamamoto","Suzuki","Kim","Park","Choi","Li","Wang","Zhang","Liu","Chen","Yang","Singh","Khan"];

function pick<T>(a: readonly T[]): T { return a[Math.floor(Math.random()*a.length)]; }
function pickN<T>(a: readonly T[], n: number): T[] { return [...a].sort(()=>Math.random()-0.5).slice(0,n); }

const allNames = NICHES.flatMap(n => PREFIXES.slice(0,20).map(p => `${p} ${n} ${pick(TYPES)}`));
const names = [...new Set(allNames)].sort(()=>Math.random()-0.5).slice(0,530);

async function main() {
  const users = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const userId = (users.rows[0] as any)?.id;
  if (!userId) { console.error("No user found. Sign up first."); process.exit(1); }

  let count = 0;
  const batch: any[] = [];
  for (const name of names) {
    const cat = pick(CATEGORIES);
    const contact = `${pick(FIRST)} ${pick(LAST)}`;
    batch.push({
      userId, name, status: "active",
      website: `https://www.${name.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20)}${pick([".com",".net",".org"])}`,
      integrationType: pick(["custom","api","feed","csv"]),
      contactPerson: contact,
      contactEmail: `${contact.toLowerCase().replace(/\s/g,".")}@${name.toLowerCase().replace(/[^a-z0-9]/g,"")}.com`,
      contactPhone: `+${pick(["1","44","86","91","81","49","33"])} ${pick(["200","300","400","500","600","700"])} ${1000+Math.floor(Math.random()*9000)}`,
      category: cat, country: pick(COUNTRIES),
      tags: [...(CATEGORY_TAGS[cat]||[]), ...pickN(TAGS_POOL,3)].slice(0,6).join(", "),
      leadTime: pick(LEAD_TIMES), paymentTerms: pick(PAYMENT_TERMS),
      minOrderAmount: pick([null,null,"50","100","200","500","1000"]),
      notes: pick(NOTES[cat]||NOTES.other),
      logo: null, config: {},
    });
    count++;
    if (batch.length >= 50) { await db.insert(vendors).values(batch as any); batch.length = 0; console.log(`Inserted ${count}/${names.length}`); }
  }
  if (batch.length) await db.insert(vendors).values(batch as any);
  console.log(`Done! ${count} vendors created.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
