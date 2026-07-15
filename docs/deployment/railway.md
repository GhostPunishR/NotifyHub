# Deploying NotifyHub on Railway

NotifyHub is prepared for deployment as a Railway service using the root `Dockerfile` and `railway.json`.

## Required variables

Set these Railway variables:

```text
DISCORD_TOKEN
DISCORD_CLIENT_ID
NODE_ENV=production
DEFAULT_LOCALE=en
LOG_LEVEL=info
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_EVENTSUB_SECRET
TWITCH_EVENTSUB_CALLBACK_URL=https://<public-domain>/webhooks/twitch/eventsub
```

Do not set `DISCORD_GUILD_ID` for normal production use unless commands should exist only in one guild.

Railway provides `PORT`; the application falls back to port 3000 locally.

`TWITCH_EVENTSUB_CALLBACK_URL` must be the public Railway HTTPS URL on port 443, with the exact `/webhooks/twitch/eventsub` path. Generate a unique 10-to-100-character printable ASCII EventSub secret and store both Twitch secrets as Railway secret variables. Do not include credentials, fragments, internal hostnames, or private callback URLs.

## Deployment steps

1. Create a Railway project from the GitHub repository.
2. Select the root repository as the service source.
3. Add the required variables.
4. Deploy using the detected Dockerfile.
5. Confirm that `/health` returns a successful response.
6. Create Twitch EventSub subscriptions only after the public callback is reachable.
7. Review logs for command registration, Discord readiness, callback verification, and sanitized normalized event metadata.

## Health and shutdown

The HTTP server exposes:

- `/health`: returns `200` when the process is alive and reports Discord readiness.
- `/`: returns basic service metadata.
- `/webhooks/twitch/eventsub`: accepts signed Twitch EventSub `POST` requests on the same HTTP listener.

Railway sends `SIGTERM` during deployment teardown. NotifyHub closes the HTTP server, destroys the Discord client, stops modules, and exits cleanly.

Rotate `TWITCH_CLIENT_SECRET` through the Twitch developer console and Railway together. To rotate `TWITCH_EVENTSUB_SECRET`, update Railway and recreate EventSub subscriptions because Twitch stores the secret with each subscription. Plan the change to avoid a window where genuine notifications fail signature verification.

## Future multi-service deployment

When workers or a dashboard are added, keep the shared monorepo and create separate Railway services with workspace-specific start commands and watch paths.
