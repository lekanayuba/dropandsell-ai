---
name: AI chat gateway
description: How the in-app AI support chat reaches OpenAI and why its key is "invisible"
---

- The AI support chat uses the OpenAI SDK pointed at the Replit AI gateway via env vars
  `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.
- **Why this matters:** these `AI_INTEGRATIONS_*` vars are auto-provisioned and do NOT show up in the
  environment's visible secrets list. Seeing them "missing" in that list does not mean they are unset —
  verify actual presence with `process.env` before assuming the chat is broken due to a missing key.
- Model in use: `gpt-5.1` (confirmed working through the gateway).
