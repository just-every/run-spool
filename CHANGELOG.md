# Changelog

## Unreleased

- Pin rer 0.2.22 and support Base's `rer` mail adapter for RER Managed sign-in and alerts. RER supplies and hides the mail settings, with no provider account or copied key; Free and Assisted self-hosting provider choices remain unchanged.

- Fix-branch grants now accept a minted GitHub token only when GitHub reports its repositories as exactly the granted one (case-insensitive); a missing, empty, wider or different list revokes the token unused and refuses with a plain reason.
- The reproducer button reads "Record reproducer" with the occurrence id beside it, and Spool's sample error no longer offers the form. The release form leads with name and build; the deployment manifest and server (Go/Python) path-mapping fields sit under an optional section.

## 0.2.0 — 2026-10-15

- Reproduce supported mapped JavaScript failures in an isolated local sandbox, propose a GitHub fix branch under an explicit expiring grant, and measure rollout with affected-client and flow reports. Missing coverage remains inconclusive; exposure signals require the unpublished SDK 0.2.0.
- Accept bounded native and Sentry Python/Go exception evidence and the documented OTLP/HTTP JSON error-log profile. Python/Go source evidence does not enable JavaScript source maps or sandbox execution; traces and metrics remain unsupported.
- Add occurrence split/merge previews, guarded correction undo, operator-label assignment, literal suppression policies and release/environment deployment manifests.
- Add owner self-erasure after a verified successor handoff, with explicit attribution holds and restore fences; preserve owner-only project erasure and its external-copy limits.
- Add a private, one-use owner sign-in link through `rer signin` for the original hosted deploying checkout when mail is unavailable.
- Keep issue grouping stable across recognized JavaScript bundle content hashes while preserving distinct named files and original occurrence provenance.
- Keep exposure storage available at capacity by evicting the oldest rows and reporting the eviction. Manual retention removes exposure by its last report; discarded denominators keep measurement inconclusive.
- Explain first-run dev-key scope and the ordinary-sign-in steps needed to connect external apps, builds and agents.

### Upgrade from 0.1.0

Stop local dev with `rer dev --stop` and export a private archive before updating. In the existing checkout, run `git pull`, then `rer dev` for local use. For hosted use, retain the original deploying checkout, its private deployment receipt and account settings, then run `rer deploy` after updating it. Additive migrations `migrations/core/0020_dependencies.sql` through `migrations/core/0036_owner_signin.sql` apply automatically (17 new migrations, 36 total). Existing evidence, triage states and project keys are preserved. Keep the existing database and private settings; no reset or archive restore is needed for this upgrade.

SDK 0.2.0 remains owner-held and unpublished on npm. `npm install @just-every/spool` currently resolves to 0.1.0; the app version and tag do not publish the SDK. See [SDK changes](packages/sdk/CHANGELOG.md) and [exposure requirements](docs/REPRODUCE-AND-FIX.md#3-did-the-fix-reach-the-affected-users).

## 0.1.0

First public release: one owner, isolated projects, bounded JavaScript evidence and source maps, triage and regression, read-only agent access, private archives and empty-target restore.
