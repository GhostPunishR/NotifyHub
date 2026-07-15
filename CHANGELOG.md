# Changelog

All notable changes to NotifyHub will be documented in this file.

The project follows Semantic Versioning and uses Conventional Commits.

## [Unreleased]

### Added

- Initial modular monorepo scaffold.
- English and French localization infrastructure.
- Discord Components V2 status renderer.
- Railway deployment and contributor documentation.
- Twitch app authentication, typed Helix channel resolution, and stream enrichment.
- Signed EventSub webhook ingestion for stream online, stream offline, and channel update events.
- Twitch EventSub subscription creation, duplicate avoidance, revocation handling, and sanitized bot integration.
- Unit and HTTP integration tests for Twitch authentication, rate limits, signatures, replay protection, schemas, and normalization.

### Fixed

- Send Twitch OAuth client credentials in a form-encoded request body instead of URL query parameters.
- Reuse pending EventSub subscriptions and search paginated Helix results without unbounded cursor loops.
- Keep valid stream-online ingestion available when optional Helix enrichment times out or fails.
