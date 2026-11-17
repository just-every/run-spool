# Minimatch maintenance report
Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-8
Main baseline: 6263ba70f1d0fce4ea1df7e6bf7b4f0d827489e1
Candidate: ec7147cf4d8a300dc1e8a3f4f631af357c8df67e

## Change and rationale

Added the exact pnpm override minimatch=11.0.1 in package.json and regenerated pnpm-lock.yaml with pnpm 10.12.4. The glob 13.0.6 parent, used by the Sentry bundler plugins, still requests minimatch ^10.2.2, so its existing release does not carry the brief's required major-version fix. The override changes that one resolution from 10.2.6 to 11.0.1 and adds minimatch's required @isaacs/nonrecursive-glob-match helper at 1.1.0. No unrelated existing package was upgraded. Regenerated sources.lock.json last; its only changes are the package.json and pnpm-lock.yaml hashes.

Affected locked minimatch versions: 1 before, 0 after. All installed minimatch instances resolve to 11.0.1. Root workspace and the separate retained mail lockfile were inspected; the latter has no minimatch entry.

## Local validation

Used Node 22.20.0 and pinned pnpm 10.12.4. Before and after frozen installs passed. Lockfile regeneration passed. Local setup passed with 103 migrations and the fleet local owner. The temporary setup app exited. The required rer build and pnpm typecheck passed. Source lock generation and source:check passed. git diff --check passed. The exact command/exit receipts are in checks.receipt.json.

The existing tests/sentry-cli-compat.mjs journey exercises actual released Sentry CLI and Vite, esbuild, Rollup and webpack plugins against Spool's emitted Worker, including source-map upload and original-source mapping. The complete journey passed with exit 0, including archive, restore and erasure. Its full sanitized output is in sentry-cli-journey.log.

No tests were added, deleted, skipped or weakened. No UI, contract, acceptance, generated claims, owner screens, copy or workflow was changed. Acceptance counts remain 23 done, 54 partial, 28 missing, 105 total; clause status changes: none. No clause CLAIM is made by this dependency maintenance task.

## Publication and custody

The fleet guard pushed the product branch successfully on attempt 1. The remote branch advertises the exact candidate SHA. Exact-SHA Verify run 44142429130 completed with FAILURE: https://github.com/just-every/run-spool/actions/runs/44142429130 . Product custody is PUSHED; landing readiness is BLOCKED, and no READY claim is made. A separate clean detached worktree at the candidate supplies the exact committed tree to the Base scanner bundled with pinned rer 0.2.118. Scanner-native Gitleaks 8.30.1 was installed from its release archive after verifying its published SHA-256 checksum. The full-history scan completed in 509.98 seconds with COMPLETE/PASS and zero findings, covering 987 commits. Its source commit and tree exactly match the candidate. The scan uses the repository's public remote main as the public base and checks the injected bundle values in memory; no credential values or environment dumps are retained in the report packet.

Only cloud/gr-mt-spool-dep-8 is authorized for product publication. Report files are outside the product checkout and will be published separately to evidence/gr-mt-spool-dep-8. No PR has been created. No default branch, release or deployment is changed.

## Plan

The complete seven-step plan and actual validation scope are in PLAN.md. Independent Mac publication and landing gates remain with the fleet. This task does not land or deploy.

API budget: ten calls used, ten maximum: one Base scanner-path discovery, one Gitleaks release download metadata request, one observed scanner GraphQL call, one exact-SHA CI discovery, five CI status polls, and one terminal jobs query. One watcher operated at a time, waiting at least 301 seconds after discovery and between polls. The failed-job log command was not run because the budget was exhausted.

## Terminal CI result and blocker

Verify completed with failure on ec7147cf4d8a300dc1e8a3f4f631af357c8df67e. Job verify (wizard), ID 134249458782, failed at "Run suites (wizard, 8-minute deadline)". The jobs API identifies the failed step; it does not establish an assertion failure, timeout, transport failure or other root cause. The downstream shards (spool) and verify jobs also failed. This is not a contract-generator-only failure, so the generated-view READY exception does not apply.

Failed source job: https://github.com/just-every/run-spool/actions/runs/44142429130/job/134249458782

The required diagnostic command is:

    gh run view 44142429130 --repo just-every/run-spool --job 134249458782 --log-failed

NOT RUN: the ten-call GitHub budget was exhausted after failed-job discovery. No log archive download was attempted, and no Forbidden or other transport error is claimed. The root cause remains unestablished. No workflow was rerun or dispatched, no tests were weakened, and no unrelated repair was guessed. The follow-up is to read this failed job's archive once, diagnose its failure and prepare a separately checked fix if needed. Do not land this candidate while exact-SHA Verify is red.

The complete job list, failed-step metadata, all five actual polls, API accounting and local checks are included in this packet. Every runtime job and the affected Sentry CLI shard passed; see ci-jobs.json for the actual result of each job. The source lock and acceptance statuses remain unchanged except for the two required source hashes.

Actual CI job counts: {"failure": 3, "skipped": 4, "success": 25}.

Terminal preservation: the product is already pushed to the named branch, and the clean maintenance clone is retained for the blocked follow-up. Report-only evidence is published separately. No main ref or PR was changed. Default: keep the product change on its branch and request wizard CI diagnosis; do not waive the Verify gate.
