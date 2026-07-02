import { db } from './db';
import { orders } from '@shared/schema';
import { and, eq, isNotNull, notInArray } from 'drizzle-orm';
import { getTrackInfo, registerTracking, isDeliveredStatus } from './tracking17track';

const TICK_MS = 60 * 60 * 1000; // hourly
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  if (!process.env.TRACKING_API_KEY) return;
  running = true;
  try {
    // Active parcels: have a tracking number, not yet delivered/cancelled.
    const active = await db.select().from(orders).where(
      and(
        isNotNull(orders.trackingNumber),
        notInArray(orders.status, ['delivered', 'cancelled']),
      )
    );
    if (active.length === 0) return;

    const numbers = active
      .map((o) => (o.trackingNumber || '').trim())
      .filter(Boolean);
    if (numbers.length === 0) return;

    let results = await getTrackInfo(numbers);

    // Register any parcels the provider isn't watching yet, then re-check just those.
    const unregistered = numbers.filter((n) => results.get(n)?.notFound);
    if (unregistered.length > 0) {
      await registerTracking(unregistered);
      const retry = await getTrackInfo(unregistered);
      retry.forEach((v, k) => results.set(k, v));
    }

    let delivered = 0;
    let updated = 0;
    for (const o of active) {
      const num = (o.trackingNumber || '').trim();
      const info = results.get(num);
      if (!info) continue;
      const payload: any = { trackingInfo: info, updatedAt: new Date() };
      if (isDeliveredStatus(info.status) && o.status !== 'delivered' && o.status !== 'cancelled') {
        payload.status = 'delivered';
        delivered++;
      }
      await db.update(orders).set(payload).where(eq(orders.id, o.id));
      updated++;
    }

    if (updated > 0) {
      console.log(`[tracking] Refreshed ${updated} parcel(s); ${delivered} newly delivered.`);
    }
  } catch (err: any) {
    console.error('[tracking] tick failed', err?.message || err);
  } finally {
    running = false;
  }
}

export function startTrackingStatusScheduler(): void {
  if (timer) return;
  // Delay first run slightly so startup isn't blocked.
  setTimeout(() => { void tick(); }, 30 * 1000);
  timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log('[tracking] Live delivery-status scheduler started (hourly).');
}
