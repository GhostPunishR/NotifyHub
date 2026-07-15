# Contributing to NotifyHub

Thank you for helping build NotifyHub.

## Communication language

English is the required language for source code, code comments, commit messages, issues, pull requests, reviews, and documentation. French and English user-facing content must be added through the i18n package rather than hard-coded in application logic.

## Before contributing

1. Search existing issues and pull requests.
2. Open an issue for significant changes before investing in implementation.
3. Keep pull requests focused on one problem.
4. Never include credentials, tokens, personal data, or production payloads.

## Development setup

```bash
git clone https://github.com/GhostPunishR/NotifyHub.git
cd NotifyHub
npm install
cp .env.example .env
npm run check
```

The bot validates both Discord and Twitch configuration at startup. For local EventSub testing, use a public HTTPS tunnel whose callback path is `/webhooks/twitch/eventsub`; never commit tunnel URLs, tokens, or webhook secrets.

## Branch names

Use a short prefix and a descriptive kebab-case name:

- `feat/twitch-eventsub`
- `fix/duplicate-delivery`
- `docs/module-contract`
- `chore/dependency-updates`

## Commit messages

Use Conventional Commits:

```text
feat(twitch): add stream online normalization
fix(i18n): use English fallback for unsupported locales
docs(contributing): document module test fixtures
```

## Pull requests

A pull request should:

- explain the problem and the chosen solution;
- reference related issues;
- include tests for behavioral changes;
- update English and French translations together;
- update documentation when architecture or configuration changes;
- pass `npm run check`;
- avoid unrelated formatting or refactoring.

## Adding or changing user-facing text

Do not hard-code user-facing strings. Add the same key to both:

- `packages/i18n/src/locales/en.ts`
- `packages/i18n/src/locales/fr.ts`

English is the fallback locale. Translation keys must remain stable and descriptive.

## Adding a network module

Read [docs/modules.md](docs/modules.md) and start from `templates/network-module`. A module must:

- implement the shared `NetworkModule` contract;
- normalize provider data into shared domain events;
- avoid importing `discord.js`;
- isolate API clients, authentication, webhooks, and polling;
- include fixtures and tests without real credentials;
- document rate limits, retry behavior, and required environment variables.

## Reporting security vulnerabilities

Do not create a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License.
