---
name: Live delivery tracking (17track)
description: How order delivery status is tracked live via the 17track API, and the quota rule that shapes the code.
---

# Live delivery tracking via 17track

Orders reflect real courier status (In Transit / Out for Delivery / Delivered) by polling the 17track API. `TRACKING_API_KEY` (secret) is the 17track token; sent as the `17token` header.

## The quota rule that drives the design
- **`register` consumes quota (1 per NEW number); `gettrackinfo` does NOT.** Free plan quota is small (~200 lifetime registrations).
- **Therefore: always `gettrackinfo` FIRST, then `register` only the numbers that come back "not registered", then re-fetch just those.** Never blanket-register before every poll.
- **Why:** blanket-registering on every refresh burns the limited quota and can exhaust it. Re-registering an already-watched number is quota-free but wasteful in calls.
- **How to apply:** any new bulk/scheduled tracking path must follow get→register-unregistered→retry. The hourly scheduler and the bulk refresh route both do this.

## API shape (v2.4)
- Base `https://api.17track.net/track/v2.4`; endpoints `register`, `gettrackinfo`, `getquota` (quota check is free).
- Status lives at `data.accepted[].track_info.latest_status.status` (values: NotFound, InfoReceived, InTransit, Expired, AvailableForPickup, OutForDelivery, DeliveryFailure, Delivered, Exception). v2.4 is required because v2.2 has no OutForDelivery.
- `rejected[]` with code `-18019909` = registered but no data yet (Pending); a "not registered / does not exist" style message means it must be registered first.

## Storage
- Order tracking status is stored in the additive `orders.tracking_info` (jsonb) column — added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, NOT drizzle push (this repo's live DB is a superset; avoid destructive push).
- Delivered detection auto-flips `orders.status` to `delivered` (never overriding `cancelled`).

## Standalone eBay tracking push (`/tracking/push-to-ebay`)
- Works for eBay orders NOT in the local DB: it fetches line items live from `sell/fulfillment/v1/order/{id}` using the user's token, so any order in the connected account can be shipped.
- **Tracking-number validation must normalize separators (strip spaces AND hyphens) BEFORE validating**, then check alphanumeric + must-contain-a-digit + length 6–40. **Why:** an earlier version rejected legit numbers typed with hyphens/spaces (e.g. "1Z 999 ... 675"), failing the "accept ANY valid carrier number" requirement.
- On success it also syncs the local order if one exists (mark shipped unless delivered/cancelled, save tracking, register with 17track) so the standalone path and the per-order path stay consistent.
