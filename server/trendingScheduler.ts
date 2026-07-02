import { trendingProducts } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { generateWeeklyProducts, BASE_TRENDING_PRODUCTS } from './trendingData';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

const VALID_PLATFORMS = [...new Set(BASE_TRENDING_PRODUCTS.map(p => p.platform))];

export async function refreshTrendingProducts(): Promise<{ count: number; weekLabel: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  const weekLabel = `${year}-W${String(weekNum).padStart(2, '0')}`;

  const products = generateWeeklyProducts();

  await db.transaction(async (tx) => {
    await tx.delete(trendingProducts);

    for (let i = 0; i < products.length; i += 20) {
      const batch = products.slice(i, i + 20).map(p => ({
        ...p,
        currency: 'GBP' as const,
        monthYear: weekLabel,
        imageUrl: null,
        productUrl: p.productUrl || null,
        vendorName: p.vendorName || null,
        vendorRating: p.vendorRating || null,
        vendorReviews: p.vendorReviews || null,
        vendorReliability: p.vendorReliability || null,
        linkVerifiedAt: now,
      }));
      await tx.insert(trendingProducts).values(batch);
    }
  });

  console.log(`[trending-scheduler] Refreshed ${products.length} trending products for ${weekLabel} with vendor data`);
  return { count: products.length, weekLabel };
}

export function startTrendingScheduler() {
  if (schedulerTimer) return;

  (async () => {
    try {
      const existing = await db.select().from(trendingProducts).limit(20);
      if (existing.length === 0) {
        console.log('[trending-scheduler] No products found, running initial seed...');
        await refreshTrendingProducts();
      } else {
        const dbPlatforms = [...new Set(existing.map(p => p.platform))];
        const hasRemovedPlatforms = dbPlatforms.some(p => !VALID_PLATFORMS.includes(p));
        const dbCount = existing.length;

        if (hasRemovedPlatforms) {
          console.log(`[trending-scheduler] Database has removed platforms (${dbPlatforms.filter(p => !VALID_PLATFORMS.includes(p)).join(', ')}), refreshing...`);
          await refreshTrendingProducts();
        } else {
          const hasVendor = existing[0].vendorName !== null && existing[0].vendorName !== '';
          const hasUrls = existing[0].productUrl !== null && existing[0].productUrl !== '';
          const url = existing[0].productUrl || '';
          const isManufacturerUrl = url && !url.includes('amazon.co.uk/s?') && !url.includes('ebay.co.uk/sch/') && !url.includes('etsy.com/uk/search') && !url.includes('aliexpress.com/wholesale') && !url.includes('google.co.uk/search') && !url.includes('walmart.com/search') && !url.includes('temu.com/search') && !url.includes('shein.co.uk/pdsearch');
          const hasFakeUrls = url.includes('/product/456') || url.includes('/p/123') || url.includes('/ul/kusku-') || url.includes('amazon.co.uk/dp/') || isManufacturerUrl;
          const titles = existing.map(p => (p.title || '').toLowerCase());
          const hasExpensiveProducts = titles.some(t => t.includes('rolex') || t.includes('samsung galaxy s24 ultra') || t.includes('dyson v15') || t.includes('macbook air') || t.includes('lg c3'));
          const createdAt = existing[0].createdAt;
          if (!hasVendor) {
            console.log('[trending-scheduler] Products missing vendor data, refreshing...');
            await refreshTrendingProducts();
          } else if (!hasUrls) {
            console.log('[trending-scheduler] Products missing seller URLs, refreshing...');
            await refreshTrendingProducts();
          } else if (hasExpensiveProducts) {
            console.log('[trending-scheduler] Products contain old expensive items, refreshing with cheaper alternatives...');
            await refreshTrendingProducts();
          } else if (hasFakeUrls) {
            console.log('[trending-scheduler] Products have old-format URLs, refreshing...');
            await refreshTrendingProducts();
          } else if (createdAt) {
            const age = Date.now() - new Date(createdAt).getTime();
            if (age > WEEK_MS) {
              console.log('[trending-scheduler] Products older than 1 week, refreshing...');
              await refreshTrendingProducts();
            } else {
              const nextRefresh = Math.round((WEEK_MS - age) / 3600000);
              console.log(`[trending-scheduler] Products are fresh (${dbPlatforms.length} platforms, next refresh in ~${nextRefresh}h)`);
            }
          }
        }
      }
    } catch (err) {
      console.error('[trending-scheduler] Initial check failed:', err);
    }
  })();

  schedulerTimer = setInterval(async () => {
    try {
      console.log('[trending-scheduler] Weekly re-evaluation: recalculating vendor rankings...');
      await refreshTrendingProducts();
    } catch (err) {
      console.error('[trending-scheduler] Weekly refresh failed:', err);
    }
  }, WEEK_MS);

  console.log('[trending-scheduler] Weekly auto-renewal started (every 7 days)');
}
