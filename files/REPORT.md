# Spool keys and owner-journey regression repairs

Task: sd-spool-design-keys-2. Repository: just-every/run-spool.
Product branch: `cloud/sd-spool-design-keys-2`. Final product head: `5379ddf99bbf5c930790b3fae60b47d8af84474e`.
Main merged: `3b7a3ebe545f3bd9c6a979ca04d5687c6a375b09`. Report stamped 2026-11-17T19:56:09Z.
Product push: successful through the fleet push guard, first attempt; remote ref matched.
CI: {"apiCallsRemaining": 0, "apiCallsUsed": 10, "command": ["gh", "api", "repos/just-every/run-spool/actions/runs?head_sha=5379ddf99bbf5c930790b3fae60b47d8af84474e&per_page=100"], "conclusion": "failure", "exactShaSuccess": false, "exit": 0, "head": "5379ddf99bbf5c930790b3fae60b47d8af84474e", "observedAt": "2026-11-17T19:55:17Z", "repository": "just-every/run-spool", "runs": [{"conclusion": "failure", "created_at": "2026-11-17T19:14:03Z", "event": "push", "head_branch": "cloud/sd-spool-design-keys-2", "head_sha": "5379ddf99bbf5c930790b3fae60b47d8af84474e", "html_url": "https://github.com/just-every/run-spool/actions/runs/44156366231", "id": 44156366231, "name": "Verify", "status": "completed", "updated_at": "2026-11-17T19:30:11Z"}], "selected": {"conclusion": "failure", "created_at": "2026-11-17T19:14:03Z", "event": "push", "head_branch": "cloud/sd-spool-design-keys-2", "head_sha": "5379ddf99bbf5c930790b3fae60b47d8af84474e", "html_url": "https://github.com/just-every/run-spool/actions/runs/44156366231", "id": 44156366231, "name": "Verify", "status": "completed", "updated_at": "2026-11-17T19:30:11Z"}, "status": "completed"}.
No PR, release, tag, default-branch push or landing was performed.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

## Plan and scope

1. Install fleet identity, decrypted-bundle credential helper, preserving commit hooks, pinned toolchain and separate evidence transport. Read launcher/repository instructions. Clone only the declared product repository, depth one/blobless and deepen as needed. Confirm the previous round head `739c7ff1575296fd329c69769364f030618a7b11`, then reapply its product changes on fresh main.
2. Read every failed job log from exact-SHA Verify 44129600501 before repairing its assertion. Reproduce the populated-upgrade and selector failures locally. Distinguish dependent aggregator failures from product failures.
3. Preserve inherited credential fields exactly, qualify additive defaults, preserve all selector refusals, and repair historical archive compatibility and successor minting. Retain the prior owner decisions for key names/use/revocation/dialogs, invitations, email alerts, backup download and project-erasure preview.
4. Run failing and touched journeys, retain permission/erasure/restore fences, generate contract/surface/integration metadata, restore generated contract views from main, and regenerate the source lock last. Run the complete build-job steps in order, complete rer build, generated checks and native export. Attempt the named release validator without substituting a release command.
5. Preserve the first real commit and each substantial commit with guarded named-branch pushes. Inspect all candidate identities/messages/trailers before every push. Merge fresh main after the published save as explicitly required by the cloud adaptation; never rewrite published history.
6. Trigger exact-SHA Verify only after local touched checks and build pass. Run long follow-up checks while remote CI runs. Reserve the final GitHub budget call for exact-SHA discovery. Publish this complete non-secret packet separately to the evidence ref. Evidence publication does not imply READY, acceptance or landing.

## Original Verify failures and repairs

Prior Verify: 44129600501, source head `739c7ff1575296fd329c69769364f030618a7b11`.

| Failed job | Original failure | Final repair/proof |
| --- | --- | --- |
| runtime 134203636598 | old-archive populated upgrade compared old SELECT-* rows against the new shape | Explicitly assert blank name and null last use, exact additive DDL, and unchanged every inherited value/constraint. Historical fixture now includes ingest, revoked-agent and deploy rows. Full expanded upgrade passes: 176 historical tables and 120 inherited rows. |
| agent-handoff 134203636621 | selector-refusals compared timestamps across successful positive controls | Valid readers must record last use and preserve authority/name; EACH malicious HTTP/CLI/MCP selector must leave complete key rows, including last use, unchanged. Full handoff passes nine groups and ten masked captures. |
| repair-recovery 134203636654 | previous-release archive restore returned HTTP 409 | Register tableless migration 0110 and project the exact previous credential trigger only for positively matched older archives. Complete schema-object inventory equality, foreign-object refusal and destination-owned replay remain mandatory. |
| tunnel 134203636658 | loader upgrade compared a pre-capture key snapshot after successful capture | Assert last use after successful capture; compare all other fields against the original snapshot, then compare complete rows across the deferred migration. |
| alerts 134203636659 | hint assertion ran immediately after destination review changed | Preserve the same required hint, using Playwright's retrying expectation for the async refresh. The original assertion also passed locally before the change. |
| owner-erasure 134203637024 | successor key mint returned Storage operation failed | Insert the optional name atomically during mint rather than a second UPDATE. Extend the post-erasure credential trigger only for metadata writes with all authority/revocation fields unchanged. Existing revoke and guarded-transfer branches remain. Full owner erasure passes three groups, successor mint and archive fences. |
| shards 134212604808; verify 134212663714 | suite dependency aggregation | Logs show successful build/runtimes and failed suite aggregation; no independent assertion to weaken. |

`METADATA-FENCE.json` proves hash, project, kind, creation, minter and minter-version mutation are refused after erasure; metadata updates and revocation work and revival fails. Migration 0110 never rewrites an existing credential row. Grants remain excluded from archives.

The deliberate test expectation changes are in old-archive, selector-refusals and loader-upgrade. Their original expectations included new descriptive/use metadata in older row shapes or across successful use. Each now proves the intended new metadata separately while preserving inherited data, authority and refusal invariants. The alerts change waits for the same required hint. The erasure assertion only adds the actual refusal response to a failure diagnostic.

## Completed local verification

The build-job sequence passed IN ORDER on the merged sources: frozen install; first-party portable contract; source lock; offline Base copies; application build; integration check; typecheck. The complete `npx -y @runeditrun/rer build` then exited 0, followed by agent-surface check, contract-docs check and native-export, all 0. `BUILD-CHECKS.jsonl` includes actual starts, completions, argv and exits, including earlier attempts rather than silently discarding them.

Full touched journeys passed: expanded old archive/populated upgrade; complete agent handoff; complete owner erasure; triage keys/archive download (22 groups, 104 base captures plus selected masked key captures); owner claim/team/invitations; alerts UI; project erasure (seven groups/eight captures). Actual receipts accompany this report. The handoff packet was 231721 of 262144 allowed UTF-8 bytes. All malicious selectors remained HTTP 403, CLI 3 and official MCP 3, with no upstream malicious client request and no key/product-row mutation.

The project-erasure proof covers typed confirmation, preview/progress/receipt, every-table canary scan, unchanged unrelated project rows, second erase, old-archive epoch refusal and independent child-row fences through HTTP and CLI, including fresh destinations and the stated brand-new-store limit. Browser and checkout cleanup passed. An earlier run returned intermittent HTTP 409 at its accepted-job assertion; the complete diagnostic rerun did not reproduce it. No refusal or timeout was relaxed, and the failed attempt remains recorded.

Actual command-driver receipts (exit 0 means the complete named command returned success):

| Command group | Exit | Completed UTC |
| --- | --- | --- |
| node tests/agent-handoff.mjs | 0 | 2026-11-17T18:35:24.026712+00:00 |
| admission | 0 | 2026-11-17T18:41:35Z |
| keys-and-backup | 0 | 2026-11-17T18:45:22Z |
| populated-upgrade | 0 | 2026-11-17T18:46:54Z |
| project-erasure | 1 | 2026-11-17T18:51:05Z |
| project-erasure-diagnostic | 0 | 2026-11-17T19:12:54.718278+00:00 |
| repair-recovery | 1 | 2026-11-17T19:19:20Z |
| sentry-loader | 0 | 2026-11-17T19:26:05Z |
| agent-door | 1 | 2026-11-17T19:26:52Z |
| agent-door | 0 | 2026-11-17T19:32:44Z |

The complete Sentry SDK/loader and agent-door commands also exited 0 on the final product SHA. The first agent-door attempt lacked its bundled browser; the successful rerun used its existing PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH setting with /usr/bin/chromium. No product or test assertion changed for that correction.

Selected real browser captures show keys, new-key dialog, revoke confirmation, owner/invitee invitation pages, email alerts, dated backup download and erase preview at 1440 and 390. Key blocks and pending invitation inputs are masked. Chromium used /usr/bin/chromium with --no-sandbox. Screens were visually inspected for the changed controls and layout; no synthetic mockups were substituted.

## Contract, release and history custody

CONTRACT.md and RELEASE.json are byte-identical to current main. Before/after counts remain **23 done, 54 partial, 28 missing, 105 total**. Zero clause judgment/meaning/status changes and zero promotions. Seed/package/release versions agree at 0.7.14. Generated ACCEPTANCE.md and docs/CLAIMS.md were checked and restored from main; neither is changed by this candidate. Source lock was regenerated last and checked.

The requested `pnpm run validate:release` was attempted and returned ERR_PNPM_NO_SCRIPT. No such script exists in this checkout/tooling. No release/tag command was substituted, no RELEASE.json entry was invented, and no clause semantics changed. This limitation is explicit rather than a claimed pass.

The first candidate reapplied the previous round LINEARLY to main `6263ba70f1d0fce4ea1df7e6bf7b4f0d827489e1`. It was saved as `2bd31e7ce754e3baf79cfde14b25df5263de740d` with skip-ci. Main then advanced with Sentry import work. The cloud adaptation explicitly requires merging updated main after a published save and forbids rebasing published history, overriding the brief's linear-only mechanics. The resulting merge had no source conflicts and preserved main's newer work and all contract judgments. `83c01b9346f6006bff062b22fa2002d648810c47` saved that merge and screenshot proof with skip-ci. The final commit merely triggers Verify after completed local checks; its source tree is identical to the merge checkpoint. Final candidate merge count: 1. No published history was rewritten.

All candidate authors/committers are Run Edit Run fleet <fleet@runeditrun.com>, with no co-author trailers. Hooks stayed active, including after dependency setup. Product branches contain no fleet packet or screenshots. No rer refresh-base was run.

## Non-passing attempts and limits

Nine of the ten GitHub calls read the prior jobs list and exactly one failed-log archive per each of eight failed jobs, with no log retry. The tenth call discovered Verify 44156366231 completed/failure on the exact final head. Candidate job details and logs were not fetched because the ten-call budget is exhausted; no failed-job rerun or unverified repair is claimed. Successful exact-SHA Verify remains the blocker. No READY is claimed.

Earlier isolated dev attempts hit existing readiness deadlines during concurrent compilation; one repair attempt passed the originally failing previous-release restore and exact rows/foreign-object checks but later failed another dev startup. Earlier managed build/handoff attempts expired before queue admission (exit 75). No deadline/assertion was weakened. An environment restart around 18:14 UTC interrupted pending runs; they are not counted as passing. A standalone emitted-worker selector probe reached its HTTP positive control but its incomplete proxied CLI/MCP fixture returned unavailable; it is not passing evidence. The later complete handoff is the definitive proof. A pre-checkpoint CLI archive attempt cloned committed main rather than the uncommitted candidate; the complete owner suite was repeated successfully after the real commit.

Receipts retain these observations. An earlier Sentry SDK attempt printed its body proof but lost the driver exit during the environment restart; only an actually completed later command is counted in the table above. No deployment, provider, real-account import, acceptance promotion or publication scan is inferred from these local tests or from evidence publication. Fleet landing and its publication scan remain separate.
