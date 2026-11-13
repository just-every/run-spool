# Spool v0.7.10 metadata plan

1. Refresh the fleet bundle, install Git credential and commit guards, and clone only just-every/run-spool shallowly with blob filtering.
2. Confirm current main is green on its exact SHA; read latest public Release and confirm v0.7.10 has no tag, matching release branch or open release PR. Read inline fleet/release rules and seed AGENTS.md. Compare actual main changes after v0.7.9.
3. Update existing application-version references in package.json, seed.json, README.md and docs/getting-started.md. Write matching CHANGELOG.md and RELEASE.json notes for local ownership-transfer guidance and pending invitation recovery. Keep rer 0.2.107, package identities, historical changelog sections and all product/tests/contract files unchanged. Do not create an absent package-lock.json or change pnpm-lock.yaml.
4. Run the existing metadata/source validation and typecheck only. Regenerate sources.lock.json last using node scripts/edition-authoring/cli.mjs lock and check via pnpm source:check. No full local suite, setup server, UI proof, new tests, publication, signing, tag or deployment.
5. Fetch fresh main and rebase the unpublished candidate. If main changed, preserve all newer assertions, redo only affected metadata/checks, and regenerate the lock last. Install fleet hooks after dependency setup, commit under explicit fleet identity, inspect every candidate identity/message/trailer and push only cloud/sd-spool-release-0-7-10 through cloud-push.py.
6. Observe exact-SHA Verify via REST with one watcher, at most one call per run per 300 seconds and ten GitHub calls total. Capture receipts; do not dispatch/rerun CI or self-submit/land. Keep reports outside product and publish an explicit report-only packet to evidence/sd-spool-release-0-7-10. Delete the product clone only after pushed work and evidence are preserved.

Plan recorded: 2026-11-13T13:39:06Z
