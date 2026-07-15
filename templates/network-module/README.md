# Network Module Template

Use this checklist when adding a new provider integration.

- Create `modules/<network>` as an npm workspace.
- Depend only on `@notifyhub/core` and provider-specific libraries.
- Export a manifest and module implementation from `src/index.ts`.
- Add API, auth, webhook, polling, schema, normalizer, and job folders only as needed.
- Normalize all provider events into shared domain events.
- Add sanitized fixtures and unit tests.
- Document environment variables, webhooks, rate limits, and retry behavior.
- Add the module to `apps/bot/src/modules.ts`.
- Update `README.md`, `ROADMAP.md`, and relevant documentation.
