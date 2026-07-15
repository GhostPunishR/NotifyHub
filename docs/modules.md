# Network Modules

Each social network is an independent workspace under `modules/`.

## Shared contract

A module exposes a `NetworkManifest` and implements `NetworkModule`. Optional capabilities such as webhook registration, polling, OAuth, or source resolution are represented by focused interfaces rather than one oversized contract.

## Expected module layout

```text
modules/example/
  src/
    client/
    auth/
    webhooks/
    polling/
    normalizers/
    schemas/
    jobs/
    index.ts
    manifest.ts
  test/
    fixtures/
  package.json
  tsconfig.json
```

Only create folders required by the provider.

## Required behavior

- Validate all external payloads at the module boundary.
- Convert provider timestamps to `Date` objects.
- Produce stable event IDs for deduplication.
- Keep provider-specific metadata inside the event metadata field.
- Verify webhook signatures before processing payloads.
- Respect documented rate limits.
- Never log access tokens, refresh tokens, signatures, or raw private payloads.
- Avoid importing `discord.js`.

## Module status

- `planned`: package structure and manifest only.
- `experimental`: active implementation without compatibility guarantees.
- `stable`: production-ready and covered by integration tests.

Use `templates/network-module` as the starting checklist for a new integration.
