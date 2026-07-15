# NotifyHub

[![CI](https://github.com/GhostPunishR/NotifyHub/actions/workflows/ci.yml/badge.svg)](https://github.com/GhostPunishR/NotifyHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.13%2B-green.svg)](https://nodejs.org/)

NotifyHub is an open-source, modular Discord bot that delivers clean creator notifications from multiple social platforms through Discord Components V2.

The project is designed around independent network modules. Twitch, Kick, YouTube, TikTok, X, and Bluesky integrations can evolve without coupling their API logic to Discord delivery.

## Project status

NotifyHub is in early development. The repository contains the production-oriented foundation, module contracts, multilingual infrastructure, Discord Components V2 helpers, contribution standards, Railway deployment configuration, and an experimental Twitch EventSub ingestion slice.

## Initial goals

- One clean Discord notification experience across supported networks.
- Independent and testable network modules.
- English and French from the first release.
- A contributor-friendly, English-first codebase and documentation.
- Safe Railway deployments with health checks and graceful shutdown.

## Supported languages

| Locale         | Status               |
| -------------- | -------------------- |
| English (`en`) | Default and complete |
| French (`fr`)  | Complete             |

All source code, comments, commits, issues, pull requests, and project documentation must be written in English. User-facing translations belong in `packages/i18n`.

## Network modules

| Module  | Package                     | Status                 |
| ------- | --------------------------- | ---------------------- |
| Twitch  | `@notifyhub/module-twitch`  | Experimental ingestion |
| Kick    | `@notifyhub/module-kick`    | Planned scaffold       |
| YouTube | `@notifyhub/module-youtube` | Planned scaffold       |
| TikTok  | `@notifyhub/module-tiktok`  | Planned scaffold       |
| X       | `@notifyhub/module-x`       | Planned scaffold       |
| Bluesky | `@notifyhub/module-bluesky` | Planned scaffold       |

## Repository layout

```text
apps/
  bot/                 Discord application and HTTP health server
packages/
  config/              Runtime environment validation
  core/                Domain types and network module contracts
  discord-ui/          Components V2 notification renderers
  i18n/                English and French resources
  logger/              Structured application logging
modules/
  twitch/              Twitch integration
  kick/                Kick integration
  youtube/             YouTube integration
  tiktok/              TikTok integration
  x/                    X integration
  bluesky/              Bluesky integration
docs/                   Architecture and operational documentation
templates/              Contributor templates for new modules
```

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- A Discord application and bot token

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Set the Discord and Twitch variables documented in `.env.example`. During development, setting `DISCORD_GUILD_ID` registers slash commands in one guild for immediate updates. See [`modules/twitch/README.md`](modules/twitch/README.md) for Twitch application and EventSub setup.

## Quality checks

```bash
npm run check
```

This runs formatting verification, linting, TypeScript project checks, tests, and production builds.

## Railway deployment

NotifyHub includes a multi-stage `Dockerfile`, a Railway configuration file, an HTTP health endpoint, and graceful `SIGTERM` handling. See [the Railway deployment guide](docs/deployment/railway.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Internationalization](docs/i18n.md)
- [Network modules](docs/modules.md)
- [Railway deployment](docs/deployment/railway.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

NotifyHub is released under the [MIT License](LICENSE).
