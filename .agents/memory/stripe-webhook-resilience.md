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
- If the connector is gone, `listConnections('stripe')` returns [] and every
  checkout/billing-portal route fails with "Stripe credentials not available";
  customers can't pay. Fix = reconnect via proposeIntegration, then re-enable
  the disabled endpoint in the Stripe dashboard and replay missed events.
