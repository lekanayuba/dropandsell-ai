import { db } from './db';
import { paypalPayoutAccruals } from '@shared/schema';
import { users } from '@shared/models/auth';
import { inArray, sql } from 'drizzle-orm';

export const PAYPAL_RECIPIENT_HANDLE = 'OLADIRANOJO';
export const PAYPAL_AMOUNT_PENCE = 10;
// "Active" for billing purposes = paying or in trial. Mirrors the rest of the app.
const ACTIVE_STATUSES = ['active', 'trialing'];

const TICK_MS = 6 * 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function currentMonthYear(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function accruePaypalPayoutsForCurrentMonth(): Promise<{ inserted: number; monthYear: string }> {
  const monthYear = currentMonthYear();
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.subscriptionStatus, ACTIVE_STATUSES));

  let inserted = 0;
  for (const u of activeUsers) {
    try {
      const res = await db
        .insert(paypalPayoutAccruals)
        .values({
          userId: u.id,
          recipientHandle: PAYPAL_RECIPIENT_HANDLE,
          monthYear,
          amountPence: PAYPAL_AMOUNT_PENCE,
          status: 'pending',
        })
        .onConflictDoNothing({
          target: [
            paypalPayoutAccruals.userId,
            paypalPayoutAccruals.monthYear,
            paypalPayoutAccruals.recipientHandle,
          ],
        })
        .returning({ id: paypalPayoutAccruals.id });
      if (res.length > 0) inserted += 1;
    } catch (err) {
      console.error('[paypal-payouts] accrue failed for user', u.id, err);
    }
  }
  if (inserted > 0) {
    console.log(`[paypal-payouts] Accrued £${(inserted * PAYPAL_AMOUNT_PENCE / 100).toFixed(2)} (${inserted} subscribers) for ${monthYear} → ${PAYPAL_RECIPIENT_HANDLE}`);
  }
  return { inserted, monthYear };
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await accruePaypalPayoutsForCurrentMonth();
  } catch (err) {
    console.error('[paypal-payouts] tick failed', err);
  } finally {
    running = false;
  }
}

export function startPaypalPayoutScheduler(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log(`[paypal-payouts] Scheduler started — accruing £${(PAYPAL_AMOUNT_PENCE / 100).toFixed(2)}/month per active subscription to PayPal.Me/${PAYPAL_RECIPIENT_HANDLE} (tick every ${TICK_MS / 3600000}h)`);
}
