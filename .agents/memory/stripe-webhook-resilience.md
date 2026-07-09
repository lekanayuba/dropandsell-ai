---
name: Stripe webhook resilience
description: Why the Stripe webhook must never depend on the Stripe connection, and where the signing secret lives.
---

# Stripe webhook must never depend on the Stripe connection

The live webhook endpoint (`/api/stripe/webhook`) was once auto-disabled by
Stripe after ~9 days of consecutive 400s. Root cause: the handler fetched the
Stripe API client (via the Replit Stripe connector) **before** signature
verification, so when the connector was disconnected, every event 400'd.

**Rule:** verify the webhook signature with a credential-free Stripe instance
(`constructVerifiedWebhookEvent` in `server/stripeClient.ts`) — signature
verification needs only the `whsec_` secret, never API credentials. Fetch the
real API client lazily, only inside enrichment try/catch blocks. Return 400
only for signature failures; 500 (retryable) for internal errors on verified
events. Persistent 4xx gets the endpoint permanently disabled by Stripe.

**Why:** the connector can silently disappear (it did once — payments AND
webhooks broke together). Webhook acknowledgment must survive that.

**Environment facts (verified 2026-07):**
- `STRIPE_WEBHOOK_SECRET` exists ONLY in the production deployment secrets,
  not in the workspace/dev env — dev accepts unsigned webhooks (dev-only branch,
  compile-time excluded from prod build).
- The Stripe connector only ever got a DEVELOPMENT (test-mode) connection; the
  publish flow never offered a production setup. Live keys therefore come from
  a production-gated env fallback in `getCredentials()`: `STRIPE_SECRET_KEY`
  (global secret, live key) + `STRIPE_PUBLISHABLE_KEY` (production env var).
  Fallback only activates when `REPLIT_DEPLOYMENT === '1'` so dev can never
  silently use live keys — keep that gate. Connector wins if it ever gets
  production credentials.
- CAUTION: `STRIPE_SECRET_KEY` is a global secret, so it IS visible in the dev
  workspace env. Never read `process.env.STRIPE_SECRET_KEY` directly in new
  code or scripts — always go through `getUncachableStripeClient()`.
- If the connector is gone, `listConnections('stripe')` returns [] and every
  checkout/billing-portal route fails with "Stripe credentials not available";
  customers can't pay. Fix = reconnect via proposeIntegration, then re-enable
  the disabled endpoint in the Stripe dashboard and replay missed events.

**Basil API shape changes (verified live 2026-07):**
- Invoice payloads: `invoice.subscription` is gone — read
  `invoice.parent?.subscription_details?.subscription` (keep `||` fallback).
- `subscriptions.retrieve`: top-level `current_period_end` is gone — read
  `items.data[0].current_period_end` (keep `??` fallback).
- Symptom of missing these: webhook returns 200 but DB rows silently don't
  update (enrichment is inside try/catch). Always verify DB state after
  replaying events, never trust the 200 alone.
- Replaying missed events without dashboard access: fetch full event JSON via
  `stripe.events.list`, POST to the live webhook signed with
  `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256 of `t.payload`, header
  `Stripe-Signature: t=...,v1=...`). Handler is idempotent.
