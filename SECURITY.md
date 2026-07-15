# Security Policy

## Supported versions

NotifyHub is in pre-release development. Security fixes are applied to the latest revision of the `main` branch.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this repository. Do not open a public issue, discussion, or pull request containing vulnerability details.

Include:

- the affected component and revision;
- reproduction steps or a minimal proof of concept;
- the potential impact;
- any suggested mitigation;
- whether the issue is already public.

You should receive an acknowledgement within seven days. Timelines for validation, remediation, and disclosure depend on severity and complexity.

## Secrets

Never commit Discord tokens, API credentials, Railway variables, webhook secrets, private payloads, or database connection strings. Use environment variables and rotate any credential that may have been exposed.
