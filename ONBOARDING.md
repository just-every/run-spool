# Spool local onboarding

Use Node 22.20.0 and pnpm 10.12.4. Validate the command contract, install frozen dependencies, claim the first owner with your email, then start the private workbench:

```sh
node scripts/rer.mjs check --profile first-party
pnpm install --frozen-lockfile
pnpm run setup -- --owner-email you@example.com --port 15440
pnpm run dev -- --port 15440
pnpm run outbox
```

Setup applies additive D1 migrations to local storage, generates managed secrets in the ignored 0600 `.dev.vars`, claims one real owner through operator-auth and stops its temporary app. It preserves existing owner identity and secrets. The local development outbox sends no email: open its message and confirm the one-use sign-in link. See [OPERATIONS.md](OPERATIONS.md) before recovering an older installation. After sign-in, create one or more project scopes and save each ingest key when shown because it is not displayed again. Register the project's release and build before capture; upload a matching flat Source Map V3 file when original source locations are needed.

The installation has one owner identity. Ingest keys write only to their project, and read-only agent grants expose evidence only from their project. Accepted events are allowlisted and pattern-scrubbed before D1 storage. Inspect free text and packet previews before sharing because pattern scrubbing cannot identify every secret or personal detail. Maps and archives are private; archives exclude owner/auth records, sessions, grants and local settings. Restore requires an empty domain database. Preview retention before applying it: deleting events also deletes retry identities before the selected cutoff. Reaccepted event IDs and reuploaded map keys receive new occurrence identities; permanent erasure records continue to protect the deleted occurrences.

A fresh local database has no telemetry fixtures. All event, project, map, and archive data you add is stored in your local D1 state. Setup, development, and verification make no remote resource or provider calls. Stop development with `pnpm run dev -- --stop` before transfer, reset or switching to preview. `pnpm run deploy -- --dry-run` builds and validates the actual Worker/assets package without provider calls. Actual deployment requires separately authorized owner-account inputs and mail sender configuration; follow [OPERATIONS.md](OPERATIONS.md). Local checks do not prove hosted deployment or mail delivery.
