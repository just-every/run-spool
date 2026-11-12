# Spool Settings section split

Repository: just-every/run-spool
Branch: cloud/main-spool-settings-split-1
Candidate: a6ba9c9eb819120a3a4a40968e5220a72bd6de93
Base: 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa
Verify: https://github.com/just-every/run-spool/actions/runs/43128174623
PR: none; this repository has an exact-branch Verify entry point and the fleet owns guarded landing.

## Result

Settings now displays one of seven named sections at a time: Organization; Projects & keys; Issue processing; Alerts & integrations; Privacy & filtering; Data & archive; Audit. The navigation names every available section, adapts to permissions, and stacks within the phone width. Each section has a stable `#settings-<section>` address read by the application. Existing fragment targets are found inside their new containing section, including Slack destinations and report configuration. Refresh and browser Back/Forward retain the selected section. The navigation stays within reach when selecting a section.

The original form components remain mounted behind hidden sections so switching sections retains unsaved work. Existing permission predicates, requests, actions, confirmations, and dialogs are unchanged. Projects & keys contains project creation, keys, reports configuration and SDK setup. Issue processing contains check-ins, grouping rules/proposals, recurrence, release identity, commit sharing and feedback. Alerts & integrations contains personal notifications, Slack destinations and the scheduled alert status, with access to the existing alert-rules screen. Privacy & filtering contains scrubbing, identity policy, end-user preview and inbound filtering. Data & archive contains Business import history, archive/restore, retention/legal hold and project erasure.

## Before and after

| Measure | Before | After |
|---|---:|---:|
| Named Settings navigation links for the owner | 0 | 7 |
| Original top-level Settings component expressions retained | 23 | 23 |
| Added CI test registrations | 0 | 0 |
| Contract statuses changed | 0 | 0 |
| Contract status table: done | 23 | 23 |
| Contract status table: partial | 53 | 53 |
| Contract status table: missing | 29 | 29 |

The reproduced fresh-install page measured 15,880px at 1440 and 23,190px at 390. These observations describe the reproduction, not a test threshold. The selected Organization section now measures 900px/1,090px; Data & archive measures 2,091px/3,081px. Existing form internals were retained, so some individual sections remain long. Browser tests assert navigation, behavior and reflow rather than a height or literal heading inventory.

## Plan and implementation

The complete plan is in PLAN.md. Completed implementation steps: fleet launcher/credential/hooks setup; shallow declared-repository clone; authenticated public-door baseline reproduction; grouping while retaining every original component expression; stable addresses and old-fragment compatibility; extending the existing triage journey; adapting existing feature journeys to select their relevant section; source lock regeneration; named-branch preservation push; merge with fresh main before the final candidate (main was unchanged); identity/trailer inspection of every candidate commit; final product push through the guard.

The first implementation save was f2cbf098d443526bf36e577ff5347e65f1d7e25f with [skip ci]. The final candidate has no skip marker. Both author and committer are Run Edit Run fleet <fleet@runeditrun.com>, with no coauthor trailers. No product history was rewritten after publication. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main. No proof, evidence, report or screenshot was committed to the product branch.

## Validation and evidence

Setup, production build, typecheck and source-lock check completed successfully. The focused browser proof passed on the clean final candidate. It opens Settings through Workbench navigation at 1440, changes sections, creates and revokes a deploy key through the form/dialog, downloads a private archive, checks the nonempty-restore refusal, retains an unsubmitted project draft across section changes, and checks refresh and Back/Forward. Old Slack, reports, grouping and audit fragments reveal their containing sections. All seven sections were captured once at 1440 and once at 390. There was no horizontal overflow; desktop serious/critical Axe checks and browser-error checks passed. See browser-receipt.json, preservation-receipt.json, settings-proof.mjs and the explicitly selected images.

The existing triage journey is extended with section isolation, actual key creation/revocation, archive download, refresh/history and old links. Existing feature journey assertions are preserved; only their Settings destinations now select the correct section. No new test file or registration was added to the product tree. Some early broad local runs began during final build activity: the first triage attempt failed at its unrelated workspace-unavailable recovery assertion, Sentry SDK stopped at an issue-screen qualification before Settings, and Sentry HTTP stopped at a search-result assertion before the changed Settings flows. These failures are retained honestly, and their outcomes are not represented as passing checks. A plain import of team-flow.mjs was recognized as a no-op and excluded from passing journey evidence; teamFlow() was then explicitly invoked. Final complete run results follow below.

## Contract boundaries and custody

This round makes no DONE claim, changes no clause acceptance text or Status/Gap/Evidence cell, and adopts no new clause policy. The default grouping follows the controls already present. Complete source-lock checks and the fleet's publication, exact-main Verify and landing gates remain required. The cloud cannot run the Mac publication scan; a READY line, if earned, is branch custody only and does not waive that scan or signal acceptance/landing.

Product commits and report publication are separate. The report packet is explicitly selected for the report-only evidence ref; it contains no credentials, environment dump, held-out material, private archive, or symlink.

## Scoped claim

CLAIM UX-001 PARTIAL points=none tests=tests/triage-journey.mjs#journey

Settings section navigation and its regression checks strengthen the stable-link and responsive-surface requirement. The numbered acceptance points cover broader team and session journeys; this round does not promote a point or claim the complete clause. Clause judgments remain unchanged.

## Exact-SHA CI blocker

Verify run 43128174623 completed with failure on a6ba9c9eb819120a3a4a40968e5220a72bd6de93. The root failed job is `verify (sdk)` (130885919501): native fetch at unchanged `tests/sentry-http.mjs:80:51` throws `TypeError: fetch failed`, caused by `read ECONNRESET` (-104). This occurs in the restore/erasure HTTP section before the Settings flows. The two aggregate jobs, `shards (spool)` (130891662987) and `verify` (130891695467), propagate that failure. Build and runtime partition status in the aggregate log are success. This is not the contract-generator exception. Logs were read once for each failed job through `gh run view --job --log-failed`; the ten-call GitHub budget is exhausted. No rerun, dispatch, empty commit, or main push was used. The branch is BLOCKED by this red exact-SHA Verify, without a READY claim.

## Local runtime limitations

The whole agent-handoff run reached and passed its Settings handoff and retention screens, plus scheduled-retention checks, then stopped making progress during later archive-cap work. Its dev `/health` probe timed out after 5,002 ms with no bytes. The independently invoked whole team run also stopped making progress; its native health probe returned 503 with `Storage operation not confirmed`. Both broad runs were stopped by their verified owned PIDs after retaining diagnostics; neither is counted as a complete pass. A project-erasure attempt waited 1,184 seconds for the optional rer job slot and was stopped without executing its tests; it was restarted directly with CI queue bypass in the dedicated cloud VM. A Rollbar attempt stopped at an unchanged issue event-count screen before reaching Settings; it was restarted with the repository's Node 22.20.0 runtime. See incomplete-local-receipt.json and the separate final logs for outcomes. No unrelated transport, storage or feedback repair was added to this Settings branch.

CI log copies retain the complete failure diagnostics with workflow environment blocks omitted and injected secret values masked. The GitHub receipt keeps all ten actual invocations, including the initial empty discovery made with an incorrect SHA filter; only the subsequent exact-candidate discovery and run status are used for custody. The batch receipt records its initial HEAD as batch_head_at_start, rather than representing that startup metadata as the head of every later subprocess.

## Final local results

| Check | Result |
|---|---|
| Fleet setup, production build, typecheck | Passed |
| Focused Settings proof on final clean code | Passed; all seven sections captured at 1440/390 |
| Complete triage journey | Passed; 22 groups, 100 existing journey captures |
| Complete Sentry SDK journey, Node 22.20.0 | Passed |
| Reports configuration | Passed |
| End-user erasure preview | Passed |
| Organization audit | Passed |
| Alerts and Slack Settings | Passed, including create/test/review/rotate/revoke |
| Whole Sentry HTTP rerun | Incomplete; grouping, release identity, commit sharing and inbound-filter Settings slices passed before the later broad run stopped making progress |
| Whole team run | Incomplete; storage-unconfirmed 503 observed in its native fixture; not a pass |
| Whole agent-handoff run | Incomplete after its Settings and retention slices; no complete archive-cap pass claimed |
| Whole project-erasure rerun | Incomplete after both widths produced completed UI erasure receipts; later CLI/archive-fence work not complete |
| Rollbar rerun, Node 22.20.0 | Failed at unchanged issue event-count assertion, before Settings; not a pass |
| Exact-SHA Verify | Failed: SDK job fetch ECONNRESET at unchanged sentry-http.mjs:80 |

The full broad runs that ceased progressing were terminated through verified owned process IDs; their incomplete status is retained explicitly. No test registration was removed, skipped or weakened in the product code. No backend EPIPE/storage/feedback repair was attempted. GitHub's ten-call budget is exhausted, so there was no additional CI request or rerun.

The complete triage journey generated 100 captures of its pre-existing wider path. The packet selects the relevant Settings proof: all seven changed sections once at each requested width, plus the baseline views. The original full triage manifest is retained as a receipt; unrelated legacy screenshots are not part of the selected proof. Test-generated tracked screenshots are restored to the candidate's bytes before final custody, so they are not product changes.

## Terminal custody

Product branch publication succeeded and a read-only remote-ref check confirmed a6ba9c9eb819120a3a4a40968e5220a72bd6de93 on refs/heads/cloud/main-spool-settings-split-1. Product status is BLOCKED by red exact-SHA Verify, not READY or accepted. The packet is intended only for refs/heads/evidence/main-spool-settings-split-1, with its actual publication head reported in the terminal EVIDENCE line. The fleet still owns publication scanning and any landing. Product/test clones are removed after report transfer; this packet remains outside the clones.
