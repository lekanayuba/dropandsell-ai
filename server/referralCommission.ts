import { db } from './db';
import { referrals, wallet, transactions, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from './stripeClient';

// A single fixed key so that every reconcile run (24h scheduler, admin button,
// or invoice.paid webhook) is serialized through one Postgres advisory lock.
// This prevents two concurrent runs from both applying the same delta.
const RECONCILE_LOCK_KEY = 778412001;

// Commission rate: a referrer earns this share of every payment a referred user
// actually makes.
const COMMISSION_RATE = 0.10;

// Only payments in this currency are counted (the platform bills in GBP).
const COMMISSION_CURRENCY = 'gbp';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface ReferralCommissionChange {
  referralId: number;
  referrerId: string;
  referredUserId: string;
  referredEmail: string | null;
  current: number;
  correct: number;
  delta: number;
  paidInvoices: number;
}

export interface ReferrerDelta {
  referrerId: string;
  delta: number;
}

export interface ReconcileResult {
  dryRun: boolean;
  changeCount: number;
  totalDelta: number;
  changes: ReferralCommissionChange[];
  perReferrer: ReferrerDelta[];
  skipped: number;
}

interface PaidSummary {
  totalPaid: number; // in major units (GBP), only successful payments
  count: number; // number of paid invoices
}

// Sum every genuinely-paid invoice for a Stripe customer. A referral earns
// commission for EACH payment that actually cleared (10% of the amount paid),
// kept permanently: if the referred user later stops paying, no new invoices
// appear so no new commission accrues, but past payments are never removed.
async function sumPaidInvoices(stripe: any, customerId: string): Promise<PaidSummary> {
  let totalMinor = 0;
  let count = 0;
  let startingAfter: string | undefined = undefined;

  // Paginate so customers with long payment histories are fully counted.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page: any = await stripe.invoices.list({
      customer: customerId,
      status: 'paid',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const inv of page.data) {
      const amountPaid = inv.amount_paid || 0;
      if (amountPaid > 0 && (inv.currency || '').toLowerCase() === COMMISSION_CURRENCY) {
        totalMinor += amountPaid;
        count++;
      }
    }
    if (page.has_more && page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    } else {
      break;
    }
  }

  return { totalPaid: round2(totalMinor / 100), count };
}

// Authoritative, idempotent reconciliation of referral commission.
//
// For every referral it computes the CORRECT lifetime earnings (10% of every
// payment the referred user has actually made, confirmed against Stripe paid
// invoices), then applies only the DIFFERENCE versus what was already recorded.
// Because it adjusts by the delta (never blindly overwriting the wallet), past
// withdrawals are preserved, and a referrer's referral balance is floored at 0
// so a correction can never push it negative. Running it twice is a no-op;
// running it after a new payment tops up that payment's commission.
//
// Safety: payment truth comes from Stripe. If the Stripe client is unavailable,
// the whole run aborts (no writes). If a single customer's invoices cannot be
// fetched, that one referral is skipped (left unchanged) — a transient Stripe
// error must never be mistaken for "this user never paid" and trigger a clawback.
//
// This is the ONLY writer of referral commission. The invoice.paid webhook and
// the 24h scheduler both funnel through here so there is never a competing
// (relative vs. absolute) accounting path.
export async function reconcileReferralCommissions(
  opts: { dryRun?: boolean; referredUserId?: string; allowDownward?: boolean } = {}
): Promise<ReconcileResult> {
  const dryRun = !!opts.dryRun;
  // Monotonic by default: normal runs (24h scheduler, invoice.paid webhook) only
  // ever ADD commission and never reduce a recorded balance. This guarantees that
  // commission already earned for a past payment is never clawed back — even if a
  // stale Stripe snapshot from an overlapping run computes a lower "correct", or a
  // referred user's customer mapping is temporarily missing, or a payment is later
  // refunded. Downward corrections happen ONLY via the explicit admin audit
  // (allowDownward = true), which recomputes against fresh data on demand.
  const allowDownward = !!opts.allowDownward;

  // Payment truth lives in Stripe. Refuse to run (rather than zero everyone out)
  // if we cannot reach it.
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    throw new Error('[referral] Stripe client unavailable — aborting reconcile to avoid false clawbacks.');
  }

  // ---- Phase A (no DB lock): compute each referral's correct earnings from
  // Stripe. Network calls are kept OUT of the locked transaction so the advisory
  // lock is held only briefly during the writes.
  const refRows = opts.referredUserId
    ? await db.select().from(referrals).where(eq(referrals.referredUserId, opts.referredUserId))
    : await db.select().from(referrals);

  // referralId -> { correct, paidCount }; absent => skip (fetch failed)
  const computed = new Map<number, { correct: number; paidCount: number; email: string | null }>();
  // Cache per Stripe customer to avoid duplicate API calls.
  const paidCache = new Map<string, PaidSummary>();
  let skipped = 0;

  for (const ref of refRows) {
    const [u] = await db.select().from(users).where(eq(users.id, ref.referredUserId)).limit(1);
    const customerId = u?.stripeCustomerId || null;
    const email = u?.email ?? null;

    // No Stripe customer means the referred user has never paid through billing:
    // a legitimate zero (not an error), so it is safe to correct down to 0.
    if (!customerId) {
      computed.set(ref.id, { correct: 0, paidCount: 0, email });
      continue;
    }

    try {
      let summary = paidCache.get(customerId);
      if (!summary) {
        summary = await sumPaidInvoices(stripe, customerId);
        paidCache.set(customerId, summary);
      }
      computed.set(ref.id, {
        correct: round2(summary.totalPaid * COMMISSION_RATE),
        paidCount: summary.count,
        email,
      });
    } catch (err: any) {
      // Transient Stripe failure: leave this referral untouched this run.
      skipped++;
      console.error(`[referral] Skipping referral ${ref.id} — Stripe lookup failed: ${err?.message}`);
    }
  }

  // ---- Phase B (locked transaction): re-read referrals fresh, compute the delta
  // against the recorded value, and apply the writes atomically.
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${RECONCILE_LOCK_KEY})`);

    const fresh = opts.referredUserId
      ? await tx.select().from(referrals).where(eq(referrals.referredUserId, opts.referredUserId))
      : await tx.select().from(referrals);

    const changes: ReferralCommissionChange[] = [];
    const perReferrer = new Map<string, number>();

    for (const ref of fresh) {
      const c = computed.get(ref.id);
      if (!c) continue; // skipped (Stripe error) or added after Phase A

      const correct = c.correct;
      const current = round2(Number(ref.totalEarnings || 0));
      const delta = round2(correct - current);

      // Monotonic safety: outside the explicit admin audit, never reduce a
      // recorded balance. Skipping a negative delta leaves earned commission
      // intact and prevents stale-snapshot/transient-data clawbacks.
      if (delta <= -0.01 && !allowDownward) continue;

      const earningsChanged = Math.abs(delta) >= 0.01;
      const cyclesChanged = (ref.cyclesCredited ?? 0) !== c.paidCount;

      if (earningsChanged) {
        changes.push({
          referralId: ref.id,
          referrerId: ref.referrerId,
          referredUserId: ref.referredUserId,
          referredEmail: c.email,
          current,
          correct,
          delta,
          paidInvoices: c.paidCount,
        });
        perReferrer.set(ref.referrerId, round2((perReferrer.get(ref.referrerId) || 0) + delta));
      }

      if (!dryRun && (earningsChanged || cyclesChanged)) {
        await tx.update(referrals)
          .set({
            totalEarnings: String(correct),
            cyclesCredited: c.paidCount,
            status: correct > 0 ? 'active' : (ref.status || 'pending'),
          })
          .where(eq(referrals.id, ref.id));
      }
    }

    if (!dryRun) {
      for (const [referrerId, delta] of Array.from(perReferrer.entries())) {
        if (Math.abs(delta) < 0.01) continue;

        let [w] = await tx.select().from(wallet).where(eq(wallet.userId, referrerId)).limit(1);
        if (!w) {
          [w] = await tx.insert(wallet).values({ userId: referrerId }).returning();
        }

        // Atomic, floored-at-zero adjustment so a correction can never go negative
        // and concurrent writers cannot lose this update.
        await tx.update(wallet)
          .set({
            referralBalance: sql`GREATEST(0, ${wallet.referralBalance} + ${delta}::numeric)`,
            updatedAt: new Date(),
          })
          .where(eq(wallet.userId, referrerId));

        await tx.insert(transactions).values({
          walletId: w.id,
          type: delta >= 0 ? 'referral_bonus' : 'referral_adjustment',
          amount: String(round2(delta)),
          description: delta >= 0
            ? 'Referral commission: 10% of referred users\' confirmed payments'
            : 'Referral commission correction',
          status: 'completed',
        });
      }
    }

    return {
      dryRun,
      changeCount: changes.length,
      totalDelta: round2(Array.from(perReferrer.values()).reduce((s, d) => s + d, 0)),
      changes,
      perReferrer: Array.from(perReferrer.entries()).map(([referrerId, delta]) => ({ referrerId, delta })),
      skipped,
    };
  });
}
