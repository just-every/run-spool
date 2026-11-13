# Spool v0.7.11 release metadata candidate

Recorded 2026-11-13T23:50:58Z. Repository: just-every/run-spool.

Product branch: `cloud/sd-spool-release-0-7-11-c1`.
Product HEAD: `b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8`.
Base main: `4c14f5433cc7885a486db254549079d36443c37a`.
PR: none; this lane uses the guarded fleet lander.

## Plan and outcome

The full plan is in PLAN.md. Initialized fleet identity, decrypted-bundle Git helper and commit hooks; cloned the declared repository with `--depth 1 --filter=blob:none`; created the named branch from main. Deepened this same clone only to inspect actual landed history since v0.7.10.

Preflight found exact main Verify 43513594861 SUCCESS, main Verify 43519208086 attempt 2 SUCCESS, and Run site 43519208061 SUCCESS on 4c14f5433cc7885a486db254549079d36443c37a. Latest non-draft public Release was [Spool 0.7.10](https://github.com/just-every/run-spool/releases/tag/v0.7.10). There was no v0.7.11 tag, listed Release or competing release branch. No second release writer was observed. The historical Ruby failure was not repaired or rerun here.

Inspected both commits actually landed after v0.7.10: 169e4cb (rer 0.2.113/Base refresh and guide links) and 4c14f5433cc7885a486db254549079d36443c37a (bounded native export path validation). The actual alert18/gr-mt-spool-code-7 regex fix remains in the candidate's ancestry and its source/tests are unchanged. Release notes describe the local sign-in guidance, truthful export progress, early erasure-epoch restore refusal, non-stalling invalid export path check and matching integration guides. They contain no internal contract IDs or broader unproved acceptance claims.

Application version: **0.7.10 → 0.7.11**. `previousVersion`: **0.7.10**. Actual `package.json` source pin: **@runeditrun/rer 0.2.113**, preserved exactly. The prior Release's 0.2.107 pin claim was corrected in the new section only; historical sections remain intact. No SDK publication is claimed.

Exact changed paths:

- `CHANGELOG.md`
- `README.md`
- `RELEASE.json`
- `docs/getting-started.md`
- `package.json`
- `seed.json`
- `sources.lock.json`

`package-lock.json` does not exist in this pnpm repository and was not created. `pnpm-lock.yaml` remains unchanged. README and getting-started changes replace existing release-version references only; no homepage was edited.

Fetched fresh main and rebased with fleet identity before first push; main remained 4c14f5433cc7885a486db254549079d36443c37a. Regenerated sources.lock.json last using `node scripts/edition-authoring/cli.mjs lock`, then checked it with `pnpm source:check`. Its six changed hashes correspond only to the changed existing metadata/reference files. No product, tests, migration, contract, status, gap, evidence or generated view changed.

## Actual checks and custody

- `pnpm install --frozen-lockfile`: passed. Fleet hooks reinstalled after dependency setup.
- `pnpm run check -- --profile first-party`: passed (rer check).
- One-off metadata consistency verification: passed; package/seed/Release versions agree, previousVersion is 0.7.10, public notes exactly match the new CHANGELOG section, old sections are unchanged, rer pin unchanged, and excluded source/tests/contract/views/pnpm lock unchanged.
- `pnpm typecheck`: passed.
- Documented source lock write and `pnpm source:check`: passed.
- `git diff --check`: passed.
- Full candidate ancestry identity/trailer audit (`git log origin/main..HEAD`, including side parents) and full messages: passed; the single product commit uses fleet author and committer and has no trailers. Hooks remained active.
- Guarded product push: success on attempt 1, only the named cloud branch. No force push, main push, tag, CI dispatch/rerun, signing, Release publication, deployment or self-submission.

Local checks used Node 24.19.0 and pnpm 10.12.4 through the supplied toolchain, which retains a newer existing Node; the package declares Node 22.20.0 and CI runs that version. The engine warning did not fail the checks. No new tests, full local suite, build, setup server or browser run was needed for this metadata-only change.

Exact candidate Verify: [43527603184](https://github.com/just-every/run-spool/actions/runs/43527603184), status **completed**, conclusion **success**, SHA **b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8**. GH calls used through the recorded CI observation: 8/10. CI watcher uses REST and at least 300 seconds between observations for this run. Actual observations are retained in candidate-ci files.

Publication scan, full-history admission, exact-SHA landing and main Run site remain the fleet Mac lander's custody; the cloud does not claim them complete. Evidence publication is separate report transport and never a product READY, release or landing signal.

## Counts and clause changes

Before → after: Core 23 done / 45 partial / 19 missing / 87 total → unchanged; Agent surface 0 done / 9 partial / 9 missing / 18 total → unchanged. Full target **23 done / 54 partial / 28 missing / 105 total → unchanged**. Tests added 0, removed 0; test registrations and assertions unchanged. Clause status changes: **none**. No clause CLAIM is made by this version-only round.

## Follow-up debts and blockers

No product or metadata blocker was found. Existing RELEASE-LOCK remains for sd to route until the immutable tag is pushed. The fleet owns metadata landing and later producer, signing and publication. A tag alone remains RELEASE-PENDING; a non-draft GitHub Release readback and check-gh-release.sh exit 0 are required before any RELEASED claim. No such claim is made here.

Known limits retained in the new release section: local mail/ownership-transfer verification; restore/browser size and refused-upload limits; manual agent policy/key setup and unpublished CLI; owner-erasure substring/case matching; pre-first-project redirect; Managed-to-native archive qualification and restore lease; bounded 2 MiB/500-record imports; real-account migration and live Cloudflare mail qualification. Installer proofs, feature gates, stranger journeys, SDK publication and demo/pin work are follow-ups outside this metadata lease.

Complete actual non-secret reports and receipts live in this packet, outside the product tree. Explicit evidence selection excludes credentials, environment dumps, held-out material and symlinks. Scratch clone/dependencies will be removed only after successful product and evidence custody.

Terminal product custody: READY branch=cloud/sd-spool-release-0-7-11-c1 head=b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8
