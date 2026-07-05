---
name: Production data/email one-shots
description: How to apply production data changes and customer emails when the workspace can't write prod directly.
---

# Applying production data changes + customer emails

The production Postgres is **read-only from the workspace** (executeSql prod is
read-only). So any production data change — and any customer-facing email that
must use prod data/credentials — is applied by an **idempotent one-shot that
runs at server boot**, taking effect only after a deploy.

Two established homes for these:
- `server/index.ts` startup sequence — the place for one-shots that also **send
  email** (precedents: the Gloria cancellation block, the no-plan reminder pass).
  Uses `audit_logs` rows as per-user "already done" markers.
- `server/dataPatches.ts` (`runStartupDataPatches`) — narrow, self-checking data
  corrections. For a genuinely one-time **bulk** flip, guard with a sentinel row
  in `feature_flags` inside a transaction (INSERT-as-lock: the UPDATE only runs
  if you win the sentinel insert), so it never re-clobbers later user changes.

## Rule: split the "grant" marker from the "email" marker
When a one-shot both **grants something of value** (money/subscription time) AND
**emails** the user, use **two separate idempotency markers**:
- GRANT marker — inserted immediately after the value is applied, so the grant
  can never be applied twice across restarts.
- EMAIL marker — inserted only after a successful send, so a failed email
  **retries on a later boot without re-granting**.

**Why:** a single combined marker forces a choice between double-granting (if you
mark after email) or never retrying a failed email (if you mark after grant).
Splitting them makes money exactly-once and email at-least-once-but-deduped.

**How to apply:** identity-guard by matching BOTH userId AND email so the block
safely **no-ops in dev** (prod user ids don't exist there) — this is how you test
without emailing real customers. Access is gated on `users.subscriptionStatus`
('active'/'trialing') plus `subscriptions.currentPeriodEnd`; to grant free time,
set status active and extend currentPeriodEnd (use GREATEST(now, existing) so you
never shorten a live period). Note these grants do **not** touch Stripe — fine
only when the user's Stripe sub isn't auto-renewing (else the invoice.paid webhook
overwrites currentPeriodEnd).

**Caveat:** these startup blocks run on every instance boot; under autoscale two
simultaneous cold starts can both pass a check-then-insert marker race (bounded,
accepted by precedent). Add `pg_advisory_xact_lock` only if a specific case needs
a hard guarantee.
