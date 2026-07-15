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

## Twitch module

`modules/twitch` is an experimental provider implementation rather than a scaffold. It supports app access tokens, channel resolution, current-stream enrichment, webhook EventSub subscription management, request verification, and normalization for `stream.online`, `stream.offline`, and `channel.update`.

The module exports a focused `TwitchModule` API and has no Discord dependency. The bot owns the HTTP route and application-level event handler. Persistent subscription lookup, database uniqueness for `SocialEvent.id`, queues, and Discord delivery remain separate application concerns.

See [`modules/twitch/README.md`](../modules/twitch/README.md) for configuration, provider behavior, security details, and local testing.
