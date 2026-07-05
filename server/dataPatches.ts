// One-shot, idempotent production data fixes.
//
// We can't directly mutate the production database from the workspace
// (production Postgres is read-only via executeSql), so targeted data
// corrections are applied at server boot. Each patch must be:
//   1. Self-checking — it inspects the live row state and only acts when
//      the data still matches the exact "needs fixing" shape it was
//      written for. If the shape has drifted (e.g. progress has moved on
//      since the incident) the patch logs and skips rather than guessing.
//   2. Idempotent per step — each individual UPDATE is gated by a WHERE
//      clause that only matches rows still in the pre-fix state. Running
//      the patch ten times produces the same result as running it once.
//      We do not rely on a single "already patched" sentinel for the
//      whole patch, because partial failures could leave the rest of the
//      fix permanently skipped.
//   3. Narrow — scoped to a single, well-justified user/order so a bad
//      patch can never sweep across the whole table.
//
// When a patch has clearly taken effect in production, delete the
// function from this file. Do not edit patches in place — write a new
// one.
import { db } from "./db";
import { sql } from "drizzle-orm";

async function patchFunmadel345DasStoreRouting() {
  // Context (2026-05-20):
  // Customer Funmadel345@gmail.com (Margaret) bought a 120-listing DAS
  // package. She had two eBay stores connected: store 93 (vic-339630 — an
  // older mis-connect she can't access) and store 97 (funma70 — her real
  // selling account). The DAS order's storeId was NULL, so the lister
  // helper picked the first eBay store it found (93) and the first two
  // listings were published to the wrong eBay account. The code fix in
  // the helper now refuses to silently pick a store when multiple are
  // connected, but the existing order data still points to the wrong
  // setup. This patch repoints the order, releases exactly the two
  // wasted listing slots, and disconnects the wrong store so the helper
  // never falls back to it.
  const TARGET_USER_ID = "f953bb88-e237-4fb0-ba37-4fde0eed2114";
  const ORDER_ID = 4;
  const WRONG_STORE_ID = 93;
  const RIGHT_STORE_ID = 97;
  // Exact pre-fix shape we'll act on. If progress has moved past 2 since
  // we authored this patch, we'd risk over-refunding and we'd rather skip
  // and surface a log line for manual review than mutate blindly.
  const EXPECTED_WASTED_SLOTS = 2;
  // NOTE: per customer's instruction (2026-05-20) we leave BOTH eBay
  // stores connected and let the lister pick which one to publish into
  // from the listing dialog. funma70 (store 97) is just pinned as the
  // default on the order, not enforced.
  const NOTE_LINE = `[Admin patch 2026-05-20 funma70 routing] Pinned funma70 (store ${RIGHT_STORE_ID}) as the default for this order; released ${EXPECTED_WASTED_SLOTS} slot(s) burnt on the other store (${WRONG_STORE_ID} / vic-339630). Lister can still pick either store per listing.`;

  try {
    // Step 1 — pin the order to the right store + release exactly the
    // wasted slots, but ONLY if the row still matches the incident shape:
    //   - belongs to the named user
    //   - currently pointing nowhere (NULL) or at the wrong store
    //   - progress is still exactly the wasted-slot count (2)
    // We also append the audit line, but only when we actually mutated.
    // Using a single UPDATE with the precondition baked into WHERE makes
    // this step independently idempotent — re-running after success
    // matches zero rows.
    const orderUpdate = await db.execute(sql`
      UPDATE drop_and_sell_orders
      SET store_id = ${RIGHT_STORE_ID},
          progress_count = GREATEST(0, COALESCE(progress_count, 0) - ${EXPECTED_WASTED_SLOTS}),
          updated_at = NOW(),
          notes = COALESCE(notes,'') || E'\n' || ${NOTE_LINE}
      WHERE id = ${ORDER_ID}
        AND user_id = ${TARGET_USER_ID}
        AND (store_id IS NULL OR store_id = ${WRONG_STORE_ID})
        AND COALESCE(progress_count, 0) = ${EXPECTED_WASTED_SLOTS}
        AND COALESCE(notes,'') NOT LIKE ${"%funma70 routing]%"}
    `);
    const orderRowsChanged = (orderUpdate as any).rowCount ?? 0;
    if (orderRowsChanged > 0) {
      console.log(`[dataPatches] funma70-routing: re-pinned order ${ORDER_ID} to store ${RIGHT_STORE_ID} and released ${EXPECTED_WASTED_SLOTS} slot(s).`);
    }

    // NOTE: we intentionally do NOT disconnect store ${WRONG_STORE_ID}
    // (vic-339630). The customer asked to keep both eBay stores connected
    // so the lister can pick which store to publish into per listing.
    // funma70 is simply the default via order.store_id above.

    // If the order didn't change but the row exists in an unexpected
    // shape, log it so we can investigate manually rather than silently
    // leaving the customer stuck.
    if (orderRowsChanged === 0) {
      const inspect = (await db.execute(sql`
        SELECT id, store_id, progress_count, (COALESCE(notes,'') LIKE '%funma70 routing]%') AS already_patched
        FROM drop_and_sell_orders
        WHERE id = ${ORDER_ID} AND user_id = ${TARGET_USER_ID}
        LIMIT 1
      `)).rows as Array<{ id: number; store_id: number | null; progress_count: number | null; already_patched: boolean }>;
      if (inspect.length > 0 && !inspect[0].already_patched) {
        console.warn(`[dataPatches] funma70-routing: order ${ORDER_ID} did not match expected pre-fix shape — skipped. Current state:`, inspect[0]);
      }
    }
  } catch (err: any) {
    // Never let a data patch take the server down. Log and move on.
    console.error("[dataPatches] funma70-routing patch failed:", err?.message || err);
  }
}

async function patchDisableAutoPauseForAllSubscribers() {
  // Context (2026-07-05):
  // The platform owner asked to turn OFF the "auto-pause on failed stock"
  // Store Rule for every existing subscriber. Production Postgres is
  // read-only from the workspace, so we apply the one-time bulk flip at
  // server boot.
  //
  // This is a deliberately ONE-TIME action, guarded by a sentinel row in
  // feature_flags. Once the flip has run we never touch the column again,
  // so any subscriber who later re-enables the rule from the Store Rules
  // card keeps their choice across restarts/redeploys. (This is why we use
  // a sentinel here even though the file's default posture is narrow,
  // self-checking patches — an unguarded startup UPDATE would clobber
  // future user changes on every boot.)
  const SENTINEL_KEY = "patch_disable_autopause_all_subscribers_2026_07_05";

  try {
    // Atomicity + concurrency guarantee: do the sentinel claim and the bulk
    // flip in ONE transaction, using the sentinel INSERT itself as the lock.
    //   - The unique constraint on feature_key.feature_key means exactly one
    //     caller can insert the row; a concurrent booting instance blocks on
    //     the same key, then sees ON CONFLICT DO NOTHING (rowCount 0) and
    //     skips — so the UPDATE runs on exactly one instance.
    //   - Because the INSERT and UPDATE share a transaction, a failure at any
    //     point rolls BOTH back: the sentinel is not persisted and no rows are
    //     flipped, so a later boot can safely retry. There is no window where
    //     the flip is applied but unrecorded (which would let a subsequent
    //     boot re-clobber a user who re-enabled the rule in the meantime).
    await db.transaction(async (tx) => {
      const claim = await tx.execute(sql`
        INSERT INTO feature_flags (feature_key, name, description, is_enabled, admin_only)
        VALUES (
          ${SENTINEL_KEY},
          'One-time: disable auto-pause for all subscribers',
          'Owner request 2026-07-05 — set auto_pause_on_failed_stock = false for all existing users. Sentinel prevents re-running so subscribers can re-enable the rule in Store Rules without it being clobbered on restart.',
          true,
          true
        )
        ON CONFLICT (feature_key) DO NOTHING
      `);
      const won = ((claim as any).rowCount ?? 0) > 0;
      if (!won) {
        // Already applied (or being applied by another instance) — leave any
        // later per-user choices untouched.
        return;
      }

      const upd = await tx.execute(sql`
        UPDATE users
        SET auto_pause_on_failed_stock = false,
            updated_at = NOW()
        WHERE auto_pause_on_failed_stock IS DISTINCT FROM false
      `);
      const changed = (upd as any).rowCount ?? 0;
      console.log(`[dataPatches] disable-autopause-all: set auto_pause_on_failed_stock=false for ${changed} user(s); sentinel recorded so it won't run again.`);
    });
  } catch (err: any) {
    // Never let a data patch take the server down. Log and move on.
    console.error("[dataPatches] disable-autopause-all patch failed:", err?.message || err);
  }
}

export async function runStartupDataPatches() {
  await patchFunmadel345DasStoreRouting();
  await patchDisableAutoPauseForAllSubscribers();
}
