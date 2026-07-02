import { db } from './db';
import { sql } from 'drizzle-orm';
import { Resend } from 'resend';

const ADMIN = 'dropandsellauth@gmail.com';
const EXTENSION_URL = 'https://chrome.google.com/webstore/detail/cmhenhnoglkmfimnoidoaofnhkjnhdnk';
const APP_URL = 'https://dropandsell.online';
const SUB_URL = 'https://dropandsell.online/subscription';

const SLOT_KEY = 'subscriber_update_email_next_slot';
const LAST_SENT_KEY = 'subscriber_update_email_last_sent_at';
const INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;
const FIRE_HOUR_UTC = 9;
// If the scheduler wakes up and the slot is more than this far in the past
// (e.g. after a long outage or extended downtime), skip the missed slot and
// jump to the next future 09:00 UTC slot instead of replaying old blasts.
const STALE_SLOT_GRACE_MS = 6 * 60 * 60 * 1000;

const SUBJECT = "New: Withdraw your referral earnings straight to your bank";

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;
let running = false;

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderHtml(firstName: string, hasActive: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;padding:34px 30px;box-shadow:0 4px 12px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:22px;">
      <div style="display:inline-block;background:#285261;color:#fff;padding:9px 18px;border-radius:10px;font-weight:700;letter-spacing:.5px;">DropandSell</div>
    </div>
    <h1 style="font-size:22px;color:#285261;margin:0 0 14px;">Hi ${escapeHtml(firstName)} — withdrawals just got simpler</h1>
    <p style="font-size:15px;line-height:1.65;color:#3f3f46;margin:0 0 18px;">
      We've made it easier to get your <strong>referral earnings</strong> paid out. When you request a withdrawal, you now enter your bank details right on the Wallet page — and we deposit the funds <strong>manually into your account</strong>. No extra setup, no third-party redirects.
    </p>
    <ul style="font-size:15px;line-height:1.75;color:#3f3f46;padding-left:22px;margin:0 0 18px;">
      <li><strong>Add your bank at the moment of withdrawal.</strong> Account name, sort code and account number — that's it.</li>
      <li><strong>Manual deposit.</strong> Once approved, our team transfers the funds straight to the bank you provided.</li>
      <li><strong>Allow 5–10 working days</strong> for the deposit to reflect in your account.</li>
      <li><strong>Need to change the account?</strong> You can update your bank details any time the request is still pending.</li>
    </ul>
    ${hasActive ? `
    <div style="text-align:center;margin:26px 0 12px;">
      <a href="${APP_URL}/wallet" style="display:inline-block;background:#285261;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px;">Open my wallet</a>
    </div>
    ` : `
    <p style="font-size:15px;line-height:1.65;color:#3f3f46;margin:18px 0 0;">
      Not subscribed yet? Start a plan, refer friends and earn 10% on every payment they make.
    </p>
    <div style="text-align:center;margin:20px 0 12px;">
      <a href="${SUB_URL}" style="display:inline-block;background:#285261;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px;">Choose a plan</a>
    </div>
    `}
    <p style="font-size:14px;line-height:1.6;color:#52525b;margin:18px 0 0;">Questions? Just reply to this email.</p>
    <p style="font-size:15px;line-height:1.65;color:#3f3f46;margin:14px 0 0;">— The DropandSell team</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:26px 0 14px;">
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin:0;">© 2026 DropandSell Automation App · ${APP_URL}</p>
  </div>
</body></html>`;
}

function renderText(firstName: string, hasActive: boolean): string {
  return `Hi ${firstName},

Withdrawing your referral earnings just got simpler.

When you request a withdrawal on the Wallet page, you now enter your bank details right there — and we deposit the funds manually into your account.

• Add your bank at the moment of withdrawal (account name, sort code, account number).
• Once approved, our team transfers the funds straight to the bank you provided.
• Please allow 5 to 10 working days for the deposit to reflect in your account.
• You can update your bank details any time the request is still pending.

${hasActive
  ? `Open your wallet: ${APP_URL}/wallet`
  : `Not subscribed yet? Start a plan: ${SUB_URL}`}

Questions? Just reply — support@dropandsell.online.

— The DropandSell team
${APP_URL}`;
}

async function ensureStateTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value text,
      updated_at timestamp DEFAULT now()
    )
  `);
}

async function readState(key: string): Promise<string | null> {
  const result = await db.execute(sql`SELECT value FROM app_state WHERE key = ${key}`);
  const rows = (result as any).rows ?? result;
  if (!rows || rows.length === 0) return null;
  return rows[0].value ?? null;
}

async function writeState(key: string, value: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `);
}

/**
 * Atomically advance the slot from `expected` to `next`. Returns true iff this
 * caller "won" the slot (no other instance had already advanced it). This is the
 * idempotency primitive that protects against:
 *   - Multi-instance/double-deploy overlap
 *   - Crash-then-restart re-sending the same slot
 */
async function tryClaimSlot(expectedIso: string, nextIso: string): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE app_state SET value = ${nextIso}, updated_at = now()
    WHERE key = ${SLOT_KEY} AND value = ${expectedIso}
  `);
  const rowCount = (result as any).rowCount ?? (result as any).count ?? 0;
  return rowCount > 0;
}

/** Floor (or ceil-to) the 09:00 UTC slot for a given date. */
function alignToSlot(d: Date, mode: 'next' | 'same'): Date {
  const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), FIRE_HOUR_UTC, 0, 0, 0));
  if (mode === 'next' && slot.getTime() <= d.getTime()) {
    slot.setUTCDate(slot.getUTCDate() + 1);
  }
  return slot;
}

async function getRecipients(): Promise<Array<{ email: string; first_name: string; has_active: boolean }>> {
  const result = await db.execute(sql`
    SELECT u.email,
           COALESCE(NULLIF(TRIM(u.first_name), ''), split_part(u.email, '@', 1)) AS first_name,
           EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active') AS has_active
    FROM users u
    WHERE u.email IS NOT NULL AND u.email <> ''
      AND lower(u.email) <> ${ADMIN}
  `);
  const rows = ((result as any).rows ?? result) as Array<{ email: string; first_name: string; has_active: boolean }>;
  return rows.filter((r) => r.email && r.email.includes('@') && r.email.toLowerCase() !== ADMIN);
}

async function sendBlast(claimedSlotIso: string): Promise<void> {
  if (running) {
    console.log('[subscriber-update-email] Already running, skipping');
    return;
  }
  running = true;
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { console.error('[subscriber-update-email] RESEND_API_KEY missing — skipping'); return; }
    const resend = new Resend(apiKey);

    const recipients = await getRecipients();
    if (recipients.length === 0) {
      console.log('[subscriber-update-email] No recipients to send to');
      await writeState(LAST_SENT_KEY, new Date().toISOString());
      return;
    }
    console.log(`[subscriber-update-email] Sending to ${recipients.length} users for slot ${claimedSlotIso}`);

    const payload = recipients.map((r) => ({
      from: 'DropandSell Automation App <noreply@dropandsell.online>',
      to: r.email,
      replyTo: 'support@dropandsell.online',
      subject: SUBJECT,
      html: renderHtml(r.first_name, r.has_active),
      text: renderText(r.first_name, r.has_active),
    }));

    let totalSent = 0;
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      const res = await resend.batch.send(chunk);
      if ((res as any).error) {
        console.error('[subscriber-update-email] Batch failed', JSON.stringify((res as any).error));
        continue;
      }
      const n = (res as any).data?.data?.length || 0;
      totalSent += n;
      console.log(`[subscriber-update-email] Batch ${Math.floor(i / 100) + 1}: ${n} queued`);
    }

    const adminRes = await resend.emails.send({
      from: 'DropandSell Automation App <noreply@dropandsell.online>',
      to: ADMIN,
      replyTo: 'support@dropandsell.online',
      subject: `[Admin Copy] ${SUBJECT} — sent to ${recipients.length} users`,
      html: `<div style="font-family:sans-serif;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;margin:0 0 16px;color:#9a3412;font-size:14px;">
        <strong>Admin copy.</strong> Auto-blast just sent to <strong>${recipients.length}</strong> users (${recipients.filter((r) => r.has_active).length} active subscribers + ${recipients.filter((r) => !r.has_active).length} unsubscribed). Next run: ~48 hours from now at 09:00 UTC.
      </div>` + renderHtml('there', false),
      text: `[Admin copy] Auto-blast sent to ${recipients.length} users. Next run in ~48h at 09:00 UTC.\n\n` + renderText('there', false),
    });
    if ((adminRes as any).error) console.error('[subscriber-update-email] Admin copy failed', JSON.stringify((adminRes as any).error));

    await writeState(LAST_SENT_KEY, new Date().toISOString());
    console.log(`[subscriber-update-email] DONE for slot ${claimedSlotIso}: ${totalSent} sent + admin copy`);
  } catch (err) {
    console.error('[subscriber-update-email] Send failed:', err);
  } finally {
    running = false;
  }
}

async function scheduleNext(): Promise<void> {
  if (scheduledTimeout) { clearTimeout(scheduledTimeout); scheduledTimeout = null; }

  let slotIso = await readState(SLOT_KEY);
  if (!slotIso) {
    console.error('[subscriber-update-email] No slot stored — re-seeding to next 09:00 UTC ≥ 48h from now');
    const seed = alignToSlot(new Date(Date.now() + INTERVAL_MS), 'next');
    await writeState(SLOT_KEY, seed.toISOString());
    slotIso = seed.toISOString();
  }

  // Stale-slot recovery: if the scheduler was down for a long time, the stored
  // slot may be hours or days in the past. Fast-forward (without sending) to
  // the next future 09:00 UTC slot in 48h increments. CAS prevents conflict
  // with another instance doing the same fast-forward concurrently.
  let slotMs = new Date(slotIso).getTime();
  const now = Date.now();
  if (now - slotMs > STALE_SLOT_GRACE_MS) {
    let candidate = slotMs;
    while (now - candidate > STALE_SLOT_GRACE_MS) candidate += INTERVAL_MS;
    const newIso = new Date(candidate).toISOString();
    const swapped = await tryClaimSlot(slotIso, newIso);
    if (swapped) {
      console.log(`[subscriber-update-email] Stale slot ${slotIso} fast-forwarded to ${newIso} (skipped missed sends)`);
      slotIso = newIso;
      slotMs = candidate;
    } else {
      // Another instance updated it — re-read and continue
      return scheduleNext();
    }
  }

  const delayMs = Math.max(slotMs - now, 30 * 1000);
  const lastSent = await readState(LAST_SENT_KEY);

  console.log(`[subscriber-update-email] Next fire at ${slotIso} (in ${(delayMs / 3600000).toFixed(2)}h). Last sent: ${lastSent ?? 'never'}`);

  const currentSlotIso = slotIso;
  const currentSlotMs = slotMs;
  scheduledTimeout = setTimeout(async () => {
    // CAS: atomically advance the slot by exactly 48h. Only the instance that wins
    // the swap will send — protects against multi-instance overlap AND against a
    // crashed-mid-send process re-sending the same slot on restart.
    const nextSlotIso = new Date(currentSlotMs + INTERVAL_MS).toISOString();
    const claimed = await tryClaimSlot(currentSlotIso, nextSlotIso);
    if (claimed) {
      await sendBlast(currentSlotIso);
    } else {
      console.log(`[subscriber-update-email] Slot ${currentSlotIso} already claimed by another instance — skipping`);
    }
    await scheduleNext();
  }, delayMs);
}

/**
 * Send the same extension-update email to a single user (e.g. on signup).
 * Fire-and-forget: never throws, errors are logged. New users still also get
 * picked up by the recurring 48h blast (which queries the live users table).
 */
export async function sendExtensionUpdateEmailToUser(
  email: string,
  firstName: string | null | undefined,
  hasActiveSubscription: boolean,
): Promise<void> {
  try {
    if (!email || !email.includes('@')) return;
    if (email.toLowerCase() === ADMIN) return;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[subscriber-update-email] (signup) RESEND_API_KEY missing — skipping');
      return;
    }
    const resend = new Resend(apiKey);
    const name = (firstName && firstName.trim()) || email.split('@')[0];
    const res = await resend.emails.send({
      from: 'DropandSell Automation App <noreply@dropandsell.online>',
      to: email,
      replyTo: 'support@dropandsell.online',
      subject: SUBJECT,
      html: renderHtml(name, hasActiveSubscription),
      text: renderText(name, hasActiveSubscription),
    });
    if ((res as any).error) {
      console.error(`[subscriber-update-email] (signup) Failed for ${email}:`, JSON.stringify((res as any).error));
    } else {
      console.log(`[subscriber-update-email] (signup) Sent welcome update to ${email} (id: ${(res as any).data?.id})`);
    }
  } catch (err) {
    console.error('[subscriber-update-email] (signup) Send threw:', err);
  }
}

/**
 * Manually fire the blast right now to all current recipients (active + non-active),
 * without touching the 48h slot cadence. Used for one-off announcements between
 * the regular automated blasts.
 */
export async function triggerSubscriberUpdateBlastNow(): Promise<void> {
  await ensureStateTable();
  const manualSlotIso = `manual:${new Date().toISOString()}`;
  await sendBlast(manualSlotIso);
}

export async function startSubscriberUpdateEmailScheduler(): Promise<void> {
  try {
    await ensureStateTable();

    // First-ever start: seed the slot to the next 09:00 UTC that is at least 48h
    // away. This ensures a fresh deploy (or a brand-new dev workspace) never
    // re-blasts users right after a manual blast. Subsequent runs are anchored to
    // exact 09:00 UTC slots advanced by exactly 48h via CAS — no cadence drift.
    const existing = await readState(SLOT_KEY);
    if (!existing) {
      const seed = alignToSlot(new Date(Date.now() + INTERVAL_MS), 'next');
      await writeState(SLOT_KEY, seed.toISOString());
      console.log(`[subscriber-update-email] First start — seeded next slot to ${seed.toISOString()}`);
    }

    await scheduleNext();
    console.log('[subscriber-update-email] Scheduler started — every 2 days at 09:00 UTC');
  } catch (err) {
    console.error('[subscriber-update-email] Failed to start scheduler:', err);
  }
}
