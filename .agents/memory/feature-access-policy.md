---
name: Subscriber feature access policy
description: This app grants all authenticated subscribers full feature access (no subscription-status paywall)
---

# All authenticated subscribers get full feature access

`isSubscriber(userId)` in server/routes.ts returns true for any authenticated user
(returns `!!user`), NOT `subscriptionStatus === 'active'`.

**Why:** the owner wants every logged-in subscriber to be able to use every feature
(auto-restock, auto-settings, etc.) without a subscription paywall. All users in the
DB had NULL subscription_status, which had been blocking the subscriber-only routes.

**How to apply:** do not re-introduce `subscriptionStatus === 'active'` gating on
features unless the owner explicitly asks for a paywall. Frontend does not gate on
subscription either; ProtectedRoute only enforces auth + email verification + onboarding.
