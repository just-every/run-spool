# sd-spool-c-f124-rb2 — mechanical SDK-004 replay

Repository: just-every/run-spool. Product branch: cloud/sd-spool-c-f124-rb2.
Original builder head was fetched and printed as c6e3d08913d473d11fc75aec79e45b3bc3d14cfc, exactly the required value. The clone used `git clone --filter=blob:none` with full history and no depth limit. Main was a088c374707959f48f80051eeabc02c003113396.

## Replay and scope

Created the named branch at the verified original head. Compared all six ahead commits and their complete net change with main. Main already has byte-identical `tests/runtimes/browser.mjs`, including every candidate assertion, plus the prerequisite widgetEventId, openFeedback(eventId), and feedback hooks. The already-applied non-merge precursors were dropped through an interactive rebase onto main. The original merge-resolution net change was then reapplied to `tests/runtimes/browser/app.js` and the SDK-004 row only, from the verified original tree. No discarded lander-made candidate commit was reused.

The fixture removes the previous widget's public `beforeSendFeedback` hook, binds a new closure to the selected event ID when creating the widget, and preserves the unmodified Sentry SDK 11.6.0. The SDK-004 evidence wording documents that exact public hook lifecycle. No application behavior, test assertion or other contract judgment changes. No test was deleted, skipped or weakened. All unrelated CONTRACT.md bytes, including status prose and ID mapping, match main exactly.

Before/after parsed counts: **22 done / 52 partial / 31 missing / 105 total → 22 / 52 / 31 / 105**. SDK-004 remains **partial → partial**. All 105 statuses are identical to main. No hold release, promotion, deployment, acceptance or landing claim.

## Mechanical generation

AGENTS.md documents `node src/base/contract-docs.mjs write`, `node src/base/contract-docs.mjs check`, `node scripts/edition-authoring/cli.mjs lock`, and `pnpm source:check`. It documents no touched-clause option.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; views=node src/base/contract-docs.mjs write && node src/base/contract-docs.mjs check exit=0; source:check=0.

The generator wrote one view; check passed with zero prose errors/warnings. Restored main's complete ACCEPTANCE.md and docs/CLAIMS.md using `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`. Neither view is committed. With main's views restored, the check returns 1 solely because ACCEPTANCE.md generated content differs, exactly the brief's expected exception. Regenerated the source lock last and passed source:check. The final product history contains one new replay commit with that fresh lock, avoiding intermediate stale-lock candidates.

## Local validation

- Fleet identity and Git helper installed; commit-msg cleanup hooks preserve repository hooks.
- `pnpm install --frozen-lockfile`: exit 0. Cloud toolchain uses Node v24.19.0 and pinned pnpm 10.12.4; package engines pin Node 22.20.0, used by CI. Sentry browser pin is 11.6.0.
- `cloud_run timeout 300 npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive`: exit 0. Private setup output is excluded from evidence.
- `cloud_run timeout 300 npx -y @runeditrun/rer build`: exit 0. Build output is excluded from evidence to avoid local runtime configuration.
- `cloud_run timeout 180 pnpm typecheck`: exit 0.
- `cloud_run timeout 180 pnpm run check -- --profile first-party`: exit 0.
- `node scripts/edition-authoring/cli.mjs verify-base --offline`: exit 0.
- Contract write/check and source lock/check: exit 0, as above. `git diff --check`: exit 0.

The original `tests/sentry-sdk.mjs` journey runs through a disposable `.mjs` launcher using `node --experimental-strip-types`, never `--input-type=module` for an emitted Worker. The launcher only supplies `/usr/bin/chromium` and `--no-sandbox`; it changes no test or assertion. The candidate's full existing `qualifyBrowser` runs at both 1440 and 390, switching handled/automatic widget targets twice per reload round and reversing their order after reload.

PROBE SDK-004 widget association qualification: actual Sentry 11.6.0 widget against reference collector and public Spool intake, same program/configuration with only DSN changed, handled then automatic errors across two reload rounds at 1440 and 390 -> four SDK callback report IDs at each width equal the emitted feedback IDs, complete inbox IDs and archived IDs; messages and exact event/occurrence/issue links match; earlier links remain stable; feedback_accepted=4 per width.

Per width the actual item inventory was: session=6, transaction=4, event=4, attachment=2, log=2, replay_event=2, replay_recording=2, feedback=4, span=2, client_report=2. Spool outcomes: accepted=4; client_discarded:error:before_send=6; feedback_accepted=4; sentry_unsupported_attachment=2; sentry_unsupported_other_telemetry=2; sentry_unsupported_performance=6; sentry_unsupported_replay=4; session_stored=6. These reconcile exactly with the reference collector.

Four actual synthetic issue screens (handled and mapped, each at 1440 and 390) are included. The existing journey asserts no horizontal overflow and renders only each issue's exact widget report set and linked event IDs. No product UI code changed.

The **entire unchanged Sentry SDK suite finished with exit 0**, in addition to the exact candidate qualification above. It also completed its existing SDK-006, SDK-024, SDK-005 and SDK-008 checks. These are validation results only; they do not change clause statuses.

## Product custody

Product head: **a75507566279f885d933dcb52a41b97413240054**. One new commit on main; product branch pushed exactly once, successfully on the first guarded attempt, without skip-ci. Every candidate author and committer is Run Edit Run fleet <fleet@runeditrun.com>; complete candidate messages contain no Co-Authored-By trailers. No side parents were added. Remote branch head was independently read back and matches; remote main remained a088c374707959f48f80051eeabc02c003113396. The product checkout was clean after validation.

No PR was created: this brief uses fleet guarded landing and AGENTS.md imposes no PR requirement. Product custody is a named cloud branch only, never main/default. The Mac's publication scan and post-generation exact-SHA checks remain required; this cloud cannot perform or claim landing.

## Exact-SHA CI result and readiness

Verify run **42486174729**, https://github.com/just-every/run-spool/actions/runs/42486174729, completed with **failure** on exactly **a75507566279f885d933dcb52a41b97413240054**. This is the brief's explicit **generated-view-only READY exception**, not a claim that the workflow conclusion is success.

Four GitHub invocations were made, each at least 300 seconds after the previous invocation: exact-SHA discovery, run status, jobs, and one `gh run view 42486174729 --repo just-every/run-spool --job 128748451752 --log-failed`. The full failed-step log is included. Its source check completed and the only emitted error was:

`ACCEPTANCE.md: generated content differs; run contract-docs write.`

It reports `Contract prose: 0 errors, 0 warnings.` and exits 1 immediately there. Build job **128748451752** is the underlying failure. Coverage aggregators **128748570242** (shards (spool)) and **128748586946** (verify) fail only their dependency/coverage steps; no product test assertion ran there. Remaining jobs are skipped behind the build, plus the successful planner. The exact-SHA job listing is included (10 jobs: 3 failure, 6 skipped, 1 success). No workflow was dispatched or rerun; no empty commit or extra product push was made.

The Mac lander must generate the views from merged CONTRACT.md and rerun Verify on its landing candidate after publication scanning. No generated view is committed here. There is no real replay blocker, no semantic decision, and no landing or hold-release claim.

READY branch=cloud/sd-spool-c-f124-rb2 head=a75507566279f885d933dcb52a41b97413240054

## Evidence and cleanup

PLAN.md contains the complete plan. Actual receipts, both original and replay patches, identity/message checks, guarded push output, remote ref read-back, generation/source/typecheck/first-party/Base outputs, complete unchanged SDK suite output, CI responses and failed-step archive output, disposable cloud launcher and four synthetic screenshots are explicitly selected for the report-only evidence ref. No credentials, private setup output, environment dumps, held-out gate material or symlinks are selected. Product refs and the evidence ref are separate custody channels; evidence publication is not acceptance or landing.

Validation's browser/Worker descendants have exited. The disposable node_modules is removed after validation; the clean product clone is removed after evidence publication and verified fetch. The terminal response records that final removal. Actual packet files remain under `/home/agent/rer-consolidation/work/sd-spool-c-f124-rb2/packet/`.
