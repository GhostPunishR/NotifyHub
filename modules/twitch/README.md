# NotifyHub Twitch Module

`@notifyhub/module-twitch` is the experimental Twitch provider module for NotifyHub. It authenticates with an app access token, resolves channels, manages webhook EventSub subscriptions, verifies webhook requests, enriches live events with Helix stream data, and returns normalized `SocialEvent` objects.

The module does not import `discord.js`, render messages, select Discord targets, or expose raw Twitch payloads.

## Supported capabilities

- OAuth 2.0 client credentials with an in-memory app token cache.
- Twitch login and canonical channel URL resolution.
- Current stream lookup for online-event title, category, and thumbnail enrichment.
- Webhook subscription creation and deletion for:
  - `stream.online`
  - `stream.offline`
  - `channel.update`
- EventSub callback verification, notifications, and revocations.
- HMAC SHA-256 signature verification with constant-time comparison.
- Ten-minute message freshness validation with limited future clock skew.
- Normalization to `stream.started`, `stream.ended`, and `stream.updated`.

## Twitch developer application setup

1. Create or select an application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Copy its client ID and generate a client secret.
3. Deploy NotifyHub or expose the local HTTP server through a public HTTPS tunnel.
4. Configure the public callback as `https://<public-domain>/webhooks/twitch/eventsub`.
5. Generate a unique EventSub secret containing 10 to 100 printable ASCII characters.
6. Start NotifyHub, resolve the broadcaster, and use the exported subscription manager to create the required subscriptions.

The callback must use HTTPS on port 443 with a valid certificate. NotifyHub rejects callback URLs containing credentials, fragments, another explicit port, or a non-HTTPS scheme. Twitch's current webhook requirements are documented in [Handling Webhook Events](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/).

## Configuration

| Variable                       | Purpose                                              | Validation                                                              |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `TWITCH_CLIENT_ID`             | Twitch developer application client ID               | 1 to 100 ASCII letters or digits                                        |
| `TWITCH_CLIENT_SECRET`         | OAuth client credentials secret                      | Non-empty                                                               |
| `TWITCH_EVENTSUB_SECRET`       | HMAC secret shared with webhook subscriptions        | 10 to 100 printable ASCII characters                                    |
| `TWITCH_EVENTSUB_CALLBACK_URL` | Public callback URL used when creating subscriptions | HTTPS, port 443, exact webhook path, no query, credentials, or fragment |

All four variables are required by the bot. Secrets remain inside authentication and subscription requests and are covered by structured-log redaction rules. They are never returned in source references, normalized events, subscription results, or errors.

## Public API

Create a module with validated configuration:

```ts
import { createTwitchConfig, createTwitchModule } from '@notifyhub/module-twitch';

const twitch = createTwitchModule(
  createTwitchConfig({
    clientId,
    clientSecret,
    eventSubSecret,
    eventSubCallbackUrl,
  }),
);

const source = await twitch.resolveSource('https://www.twitch.tv/example');
await twitch.subscriptions.ensureSubscription('stream.online', source.externalId);
```

The bot passes raw HTTP bytes and headers to `handleEventSub`. HTTP response selection stays in `apps/bot`; signature and payload logic stays in this module.

## Authentication and token refresh

The module uses the Twitch OAuth client credentials flow described in [Getting OAuth Access Tokens](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow). The app token is cached in process memory, refreshed before expiration, and protected by a shared in-flight promise so concurrent callers create only one token.

If Helix returns `401`, the client invalidates the token and retries the request once with a newly acquired token. It does not repeat authentication failures indefinitely. Restarting the process clears the cache and obtains a new token on demand.

## Helix errors, rate limits, and retries

Every request has an explicit timeout, validates its expected status, and validates successful response data before it reaches provider logic. `401`, `403`, `404`, `429`, transport failures, and server errors produce typed errors.

The client parses `Ratelimit-Limit`, `Ratelimit-Remaining`, and `Ratelimit-Reset` when Twitch returns them. A `429` error exposes this safe rate-limit metadata and is marked retryable, but the module does not sleep or retry it automatically. Callers should defer work until the reset time. Server and transport errors are also marked retryable without an automatic retry. This keeps retry scheduling explicit and suitable for a future persistent queue. See Twitch's [API rate limit guide](https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits).

The only automatic Helix retry is the single token-refresh retry after `401`. Token endpoint failures are not retried automatically.

## EventSub security and responses

The verifier requires exactly one value for each Twitch EventSub message ID, timestamp, signature, and message-type header. It signs the exact raw request bytes using the message ID, timestamp, and configured secret. Missing or duplicated headers, stale or excessively future timestamps, malformed signatures, invalid JSON, and schema-invalid payloads are rejected.

Callback verification returns the Twitch challenge exactly as plain text. Notifications return a normalized event; revocations return sanitized subscription identity and status. The HTTP route returns `204` only after the application-level handler completes. Unexpected handler failures therefore cause a non-success response rather than silently acknowledging lost work.

Twitch controls webhook redelivery after a failed HTTP response. NotifyHub does not run a second webhook retry loop. The handler must remain idempotent because Twitch can deliver a message more than once.

## Event identity and deduplication

Normalized event IDs use `twitch:eventsub:<message-id>`. This is stable across delivery attempts and exposes the identity needed for database-level uniqueness. The EventSub message ID and subscription ID are also available as sanitized scalar metadata.

There is deliberately no in-memory-only deduplication cache. Until a persistent event repository exists, duplicate prevention across processes or restarts is not complete.

## Local testing

Tests use Node.js's test runner, generated HMAC signatures, sanitized fixtures, and injected `fetch` implementations. They never call Twitch. Run the full suite with:

```bash
npm install
npm run check
npm run build
```

To test Twitch end to end, use a temporary public HTTPS tunnel to the existing bot port, set the callback URL to the tunnel's `/webhooks/twitch/eventsub` path, and create a short-lived test subscription. Never commit the tunnel address or credentials. Twitch does not support an unencrypted localhost callback.

## Secret rotation

- Rotate the client secret in the Twitch developer console and deployment environment together. Existing app access tokens remain in memory until refresh or invalidation.
- Rotate the EventSub secret by updating the deployment and recreating subscriptions with the new secret. Each existing subscription continues signing with the secret supplied when it was created.
- During rotation, coordinate deployment and subscription replacement to avoid rejecting genuine notifications.

## Known limitations

- Persistent subscriptions, guild mappings, and OAuth connection storage are not implemented.
- Persistent event uniqueness, queues, delivery retries, and Discord delivery are not implemented.
- The development-safe bot handler logs only event ID, network, type, source identity, and occurrence time.
- Duplicate-subscription detection examines the enabled subscriptions returned by the current Helix response; pagination and cross-process creation races still require persistent coordination.
- `stream.online` enrichment depends on a current stream being visible through Helix. The normalized event remains valid without optional enrichment when no stream is returned.
- Revocations are surfaced and logged but are not automatically recreated.
- EventSub webhook secret rotation requires subscription replacement.
