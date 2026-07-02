---
name: eBay shared App ID daily quota (error 518)
description: Why "eBay daily limit" errors hit many sellers at once, and what conserves the shared quota
---

# eBay shared App ID daily call quota (error 518)

All sellers on this platform OAuth-authorize their OWN eBay account (each gets a user
`authToken`), but every Trading API call goes through ONE shared developer App ID
(`EBAY_APP_ID`/`EBAY_CERT_ID`/`EBAY_DEV_ID`, see `getFullCredentials` in
`server/marketplaces/ebay.ts`). eBay's Trading API **daily call limit is per App ID**,
so the whole user base shares ONE daily budget. When it's exhausted → error **518**
("application has exceeded usage limit") → EVERY seller is blocked until it resets
(~24h). Symptom signature: many users blocked simultaneously + the word "daily".

**Why:** an unaudited eBay app defaults to a low daily call ceiling (~5,000/day).
Each publish burns multiple calls: one `UploadSiteHostedPictures` PER image, plus
`AddFixedPriceItem`, plus mostly-cached GetUser/policy/category lookups. With a large
user base this is exhausted fast.

**The only permanent fix (owner action, cannot be done in code):** the eBay developer
account owner must request a higher call limit via the eBay Developer Program
"Application Growth Check" / compliance audit — audited apps jump to ~1.5M calls/day.

**How to apply / conserve the shared quota in code:**
- Per-image EPS upload is the biggest variable cost. Importing MORE images per listing
  multiplies calls — balance "import all images" requests against quota pressure.
- `convertImagesForEbay` skips re-uploading images already hosted on eBay
  (`ebayimg.com`/`ebaystatic.com`, matched via `new URL().hostname` exact/subdomain —
  NOT substring regex, which would match lookalikes like `fakeebayimg.com`).
- GetUser/policy/category/aspect calls are memoized via `_cached` — keep them cached.
- 518 auto-retries only ~30s (short bursts); a truly exhausted daily quota won't clear
  until reset, so the user-facing 518 message must mention the ~24h reset, not "minutes".

**Distinct from** per-account eBay *selling* limits (monthly, per seller's own account,
handled by `isAccountListingLimit`): those need the SELLER to request a higher limit in
Seller Hub → Monthly selling limits. Keep the two messages separate.
