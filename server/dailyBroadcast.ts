import { pool } from "./db";
import { storage } from "./storage";
import { sendListingResolvedEmail } from "./email";

// Today's announcement was already sent manually, so the recurring campaign
// starts tomorrow and runs for one month.
const CAMPAIGN_START = "2026-06-05";
const CAMPAIGN_END = "2026-07-05";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
let lastCheckedAt = 0;
let checkInProgress = false;

export async function ensureBroadcastCampaignTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_campaign_log (
      broadcast_date date PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function claimToday(): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO broadcast_campaign_log (broadcast_date)
     SELECT CURRENT_DATE
     WHERE CURRENT_DATE BETWEEN $1::date AND $2::date
     ON CONFLICT (broadcast_date) DO NOTHING
     RETURNING broadcast_date`,
    [CAMPAIGN_START, CAMPAIGN_END]
  );
  return (result.rowCount ?? 0) > 0;
}

async function sendDailyBroadcast(): Promise<void> {
  const users = await storage.getAllVerifiedUsers();
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    if (!u.email) continue;
    try {
      const ok = await sendListingResolvedEmail(u.email, u.firstName || "");
      if (ok) sent++;
      else failed++;
    } catch (err: any) {
      failed++;
      console.error(`[daily-broadcast] failed for ${u.email}:`, err?.message || err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`[daily-broadcast] done. Sent: ${sent}, Failed: ${failed}`);
}

export function maybeRunDailyBroadcast(): void {
  // Only ever run on the live published site, never against the dev/test database.
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;
  const now = Date.now();
  if (checkInProgress) return;
  if (now - lastCheckedAt < CHECK_INTERVAL_MS) return;
  lastCheckedAt = now;
  checkInProgress = true;

  (async () => {
    try {
      const claimed = await claimToday();
      if (claimed) {
        console.log("[daily-broadcast] claimed today's slot; sending listing-resolved email.");
        await sendDailyBroadcast();
      }
    } catch (err: any) {
      console.error("[daily-broadcast] check failed (non-fatal):", err?.message || err);
    } finally {
      checkInProgress = false;
    }
  })();
}
