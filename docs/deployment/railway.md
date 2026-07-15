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
```

Do not set `DISCORD_GUILD_ID` for normal production use unless commands should exist only in one guild.

Railway provides `PORT`; the application falls back to port 3000 locally.

## Deployment steps

1. Create a Railway project from the GitHub repository.
2. Select the root repository as the service source.
3. Add the required variables.
4. Deploy using the detected Dockerfile.
5. Confirm that `/health` returns a successful response.
6. Review logs for the command registration and Discord-ready events.

## Health and shutdown

The HTTP server exposes:

- `/health`: returns `200` when the process is alive and reports Discord readiness.
- `/`: returns basic service metadata.

Railway sends `SIGTERM` during deployment teardown. NotifyHub closes the HTTP server, destroys the Discord client, stops modules, and exits cleanly.

## Future multi-service deployment

When workers or a dashboard are added, keep the shared monorepo and create separate Railway services with workspace-specific start commands and watch paths.
