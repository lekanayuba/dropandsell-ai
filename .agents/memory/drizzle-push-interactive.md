---
name: Drizzle db:push interactive prompt can't be piped
description: Why `npm run db:push` hangs on new tables and how to work around it
---

When `drizzle-kit push` sees a brand-new table it can't distinguish from a rename,
it shows an interactive arrow-key selector ("create table" vs "rename from X").

**Problem:** This TUI reads from the terminal directly, so piping stdin
(`printf '\n' | npm run db:push`, `--force`) does NOT drive the selection — it re-prompts every time.

**How to apply:** For a single new table, create it directly with SQL
(`CREATE TABLE IF NOT EXISTS ...` via the executeSql code-execution callback, which
writes to the dev DB) matching the Drizzle schema column-for-column
(snake_case names, serial PK, defaults). Future pushes then see it as existing.
