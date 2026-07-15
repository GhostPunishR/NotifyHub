# Architecture

NotifyHub uses a shared npm-workspaces monorepo. The architecture separates provider ingestion, domain normalization, Discord rendering, and runtime orchestration.

## Dependency direction

```text
apps/*
  -> packages/*
  -> modules/*

modules/*
  -> packages/core

packages/discord-ui
  -> packages/core
  -> packages/i18n

packages/core
  -> no internal package
```

Network modules must not depend on Discord. They produce normalized events that can later be delivered to Discord, webhooks, or other transports.

## Runtime flow

```text
Provider webhook or poller
  -> network module
  -> normalized SocialEvent
  -> deduplication
  -> queue
  -> subscription lookup
  -> Discord Components V2 renderer
  -> delivery
  -> delivery audit record
```

The current scaffold implements contracts and runtime foundations. Persistence, queues, and production provider clients are roadmap items.

## Application boundaries

- `apps/bot`: Discord gateway, slash commands, command registration, HTTP health endpoint, and shutdown lifecycle.
- `packages/core`: stable domain contracts shared by modules and delivery layers.
- `packages/config`: strict environment parsing and validation.
- `packages/i18n`: locale resolution and translation resources.
- `packages/logger`: structured logs suitable for Railway.
- `packages/discord-ui`: Discord Components V2 output.
- `modules/*`: provider-specific APIs, webhooks, polling, authentication, and normalization.

## Design rules

1. Provider payloads never escape their module without normalization.
2. User-facing strings are translated, never hard-coded.
3. Stable IDs are used for event deduplication.
4. External calls must have timeouts, bounded retries, and structured logs.
5. Shutdown handlers stop accepting work before disconnecting clients.
