# gr-mt-spool-dep-12: patched transitive qs

Author: Run Edit Run fleet, 2026-11-17.

The current main lockfile contained vulnerable qs 6.16.0 through packages/agent → @modelcontextprotocol/sdk 1.32.1 → Express 5.3.0. Express permits ^6.16.0, so a pnpm recursive targeted update reuses the already locked patched qs 6.17.1 without an override, manifest change or parent upgrade. The independent body-parser path already used 6.17.1.

Changed files: pnpm-lock.yaml and its generated hash in sources.lock.json. Unique qs versions: 2 → 1. Vulnerable qs versions: 1 → 0. Other dependency upgrades: 0. Added/removed test registrations: 0/0. Clause status changes: none. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain unchanged.

## Plan and implementation

The complete plan is in PLAN.md. The implementation follows that plan: fleet authentication and identity, a fresh full-history product clone on the named branch, a dependency-path investigation, a minimal pnpm 10.12.4 lock update under Node 22.20.0, local checks, a source relock, commit identity inspection, exact committed-tree publication scanning, guarded branch publication and exact-SHA Verify, followed by separate report transport. No UI work, provider deployment or default-branch write is part of this maintenance task.

The root-only targeted pnpm update reported no change because the affected import belongs to the agent workspace. The recursive command updated only the qs resolution. No manual lockfile editing was used.

## Local results

Frozen installation, explicit local setup (103 migrations), build, typecheck, source-lock regeneration/check and whitespace checks passed. See checks.json and selected actual logs for commands and results. The setup log stays private because the setup command prints local access links; its successful result is recorded in checks.json.

The behaviour probe loads qs through Express, reproduces TypeError with the old 6.16.0 for own toString values consisting of a string, null and a number, and verifies safe stringification with 6.17.1. Ordinary comma-separated strings and nested query parsing also pass. See qs-behaviour.json.

The existing agent handoff public journey passed all nine groups, produced ten masked captures, and stopped all its children and removed its fixture directory. The candidate working tree is clean; its one new commit has fleet author and committer identities and no trailers.

## Publication blocker and custody

Candidate: `cloud/gr-mt-spool-dep-12`, `215d2fbf2b70cdbeb0ab6404b062c5ba09bfbeaf`. Its exact tree is `50a2660bbe4b586039fd20b8893c552dc5ddd6c9`.

Base's pinned rer 0.2.118 publication scanner with Gitleaks 8.30.1 inspected a separate raw committed-tree checkout matching that commit and tree. After hydrating missing history and replacing the default 300-second deadline with the supported 1800-second timeout, the final scan inspected 987 commits, 977 trees, 8,224 blobs and 23 tag messages in about 598 seconds. It returned exit 2, INCOMPLETE, with zero new findings and 870 pre-existing `scan.github-incomplete` entries. GitHub reference visibility could not be established. The scanner does not expose the HTTP responses, so no HTTP status or credential failure is inferred. The complete value-free report is publication-scan.json; the earlier deadline receipt is also retained.

The scanner automatically made 49 GitHub API calls through its GraphQL/REST fallback, despite the ten-call task budget. Two earlier direct read calls located and inspected the Base scanner entry point. No further API requests were made. This unbounded internal fallback should have been bounded before the scan; it is recorded rather than hidden. No scanner result has been overridden, and no private reference has been relabelled public.

The required COMPLETE/PASS gate was not met. The product branch was therefore not pushed, no PR was created, and exact-SHA CI was not started or claimed green. CI run IDs: none. No product push failed; publication was withheld before any product push. The report-only evidence ref is separate from product custody and does not make this candidate READY.

The complete product clone is retained at `/home/agent/rer-consolidation/work/maint/gr-mt-spool-dep-12/repo`. A full candidate bundle has been saved outside the clone and verified:

- Path: `/home/agent/rer-consolidation/work/push-rescue/gr-mt-spool-dep-12-215d2fbf2b70.bundle`
- SHA-256: `4c0618d7e67c535669871dfc9c85ab7b86e507af5c0029c6c0b3e23aae57a7c4`
- Candidate head: `215d2fbf2b70cdbeb0ab6404b062c5ba09bfbeaf`

Keep the VM, clone and bundle until the fleet retrieves this unpublished candidate. The default is to leave the product unpublished until the fleet can complete publication reference inspection under its account and budget controls. No owner ruling, product redesign or clause change is needed. The evidence transport alone is authorized to publish the non-secret report packet.

All local product work is complete. Maintenance result status is `cannot` solely because publication remains blocked; security is true because the listed vulnerable dependency resolution is removed and its patched behaviour is verified. See checks.json and result.json for machine-readable outcomes.
