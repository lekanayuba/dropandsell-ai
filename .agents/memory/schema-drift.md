---
name: schema drift fix
description: How to fix "column X does not exist" (42703) errors when this project's code is ahead of the database.
---

# Schema drift (code ahead of DB)

Symptom: app runs but logs `error: column "..." does not exist` (Postgres code 42703),
e.g. from getAddonCatalog / getMarketplaceListings / background sync. The Drizzle schema
in `shared/schema.ts` defines the column, but the actual DB lacks it.

## Fix
Add the missing column(s) directly with idempotent SQL against the dev DB, e.g.:
`ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>` (match `shared/schema.ts`).
Then restart the "Start application" workflow and re-check logs; iterate for any further
missing columns that only surface on specific code paths.

**Why not `npm run db:push`:** drizzle-kit push asks interactive "created or renamed?"
prompts for each new column. Those prompts require a real TTY — piping newlines / `yes ""`
does NOT answer them (the process just hangs until timeout, exit 143). `--force` does not
skip these rename-disambiguation prompts. Blindly accepting defaults also risks accepting a
wrong column *rename* and losing data. `ADD COLUMN IF NOT EXISTS` is deterministic and safe.

**How to apply:** grep the failing column in `shared/schema.ts` to get its exact type,
ADD COLUMN IF NOT EXISTS it, restart, verify logs are clean (only a normal /api/auth/me 401
should remain).
