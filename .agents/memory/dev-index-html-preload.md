---
name: dev index.html preload shadows Vite
description: server/index.ts preloads a built index.html and serves it at "/", which breaks the dev server unless gated to production
---

# server/index.ts index.html preload must be production-only

`server/index.ts` preloads a built `index.html` (from `dist/public/index.html` or
`<moduleDir>/public/index.html`) into `indexHtmlContent` and serves it directly for
`GET /`. If that preload runs in development, it shadows the Vite dev middleware
(`server/vite.ts` `setupVite`) at `/`, serving stale HTML that references old hashed
asset filenames → blank page + "Expected a JavaScript-or-Wasm module script but the
server responded with a MIME type of text/html".

**Rule:** the preload loop must be gated `if (process.env.NODE_ENV === "production")`
so `indexHtmlContent` stays null in dev and `/` falls through to Vite.

**Why:** discovered when importing an external full-source build of this app — the
zip shipped a stale `dist/` and the dev branch (`setupVite`) was correct, but the
`/` short-circuit served the built HTML before Vite could.

**How to apply:** if the app boots but the preview is blank with a module MIME error,
check for any handler serving a prebuilt index.html at `/` in dev.
