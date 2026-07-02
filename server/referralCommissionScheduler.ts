import { reconcileReferralCommissions } from './referralCommission';

const TICK_MS = 24 * 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const res = await reconcileReferralCommissions({ dryRun: false });
    if (res.changeCount > 0) {
      console.log(`[referral-commission] Reconciled ${res.changeCount} referral(s); net £${res.totalDelta.toFixed(2)} adjusted.`);
    }
  } catch (err) {
    console.error('[referral-commission] tick failed', err);
  } finally {
    running = false;
  }
}

export function startReferralCommissionScheduler(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => { void tick(); }, TICK_MS);
  console.log('[referral-commission] Scheduler started — 10% commission on referred users\' confirmed payments (tick every 24h).');
}
