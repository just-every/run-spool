# sd-spool-alerts-clock-2 plan

1. Configure fleet identity, bundle-only Git authentication and clone-local commit hygiene.
2. Fresh full-history partial clone of just-every/run-spool; require clock-1 SHA 19c2323f302a5e51ab0f2afc13e08e60f0f70745, branch cloud/sd-spool-alerts-clock-2 from it and merge fresh main only if needed.
3. Add one tests-only improvement: assert every session started/timestamp and stored error receipt lies in the fixed [start,end) window; include the stamp identity/value and window in failures. Check explicitly restamped prior and scheduled receipts against their own windows. Preserve every existing assertion and timeout.
4. Set up and build the emitted Worker using the pinned repository toolchain. Run deterministic REPRO/PROBE across a simulated minute boundary using the actual fixture helpers, candidate SQL and decision() over SQLite, and exercise guard failures at start/end. This small-script proof does not claim another full native Worker journey. Run tests/alerts-native.mjs once under a hard timeout directly in this dedicated VM.
5. Run typecheck, regenerate source lock LAST with node scripts/edition-authoring/cli.mjs lock, then pnpm source:check; record exit codes and check the final diff.
6. Commit with fleet author/committer and hooks, inspect all candidate identities/messages/trailers, push only cloud/sd-spool-alerts-clock-2 through cloud-push.py. No generated contract view edits, product changes, contract changes or proof directory.
7. Discover and poll exact-SHA Verify through bounded gh REST (one watcher; at least 300 seconds between calls for the run; ten-call budget). Diagnose a failure once per failed job; only the specified sole project-erasure 409 flake may be rerun once.
8. Publish complete explicitly selected non-secret report/receipt packet only to evidence/sd-spool-alerts-clock-2, preserve terminal product provenance, remove product clone and node_modules after publication, emit SD outcome and truthful READY/PUSHED/BLOCKED custody.

No clause status or claim changes; no landing claim. Repository guidance does not require a PR for this branch landing.

## Resume and CI recovery

Retain the already published one-commit improvement rather than creating an extra commit. Independently verify its remote head, lease, original assertions and receipt hashes from a second fresh full-history clone. Rerun the deterministic small-script proof; retain the once-only native alerts receipt. Preserve the original GitHub-call ledger and one-watcher cadence. Inspect the cancelled exact-SHA run's jobs, then recover only the cancelled/failed CI work when possible; do not push another product save or weaken checks to obtain green. Report terminal state honestly and publish all relevant cancellation/recovery receipts.
