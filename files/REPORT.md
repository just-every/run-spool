# sd-spool-sdk027-7

Author: Run Edit Run fleet (sd), 2026-11-17 UTC.

## Plan

1. Start from fresh origin/main (3308d2c1), fetch the proven carry dce7b40c, and apply its net six-file diff from e29a9f44 as one ordinary linear commit. Preserve main's newer SDK-004 feedback behavior and wording byte-for-byte.
2. Install the pinned repository dependencies and fleet commit hooks. Regenerate sources.lock.json last, check the source lock, typecheck, inspect the complete candidate diff and identities, and verify that origin/main..HEAD has no merge commits.
3. Commit the candidate and preserve it immediately on cloud/sd-spool-sdk027-7 with the cloud push guard. Run committed exact-SHA preview, 150,000-event erasure, 160,000-event archive and feedback journeys under a 2,400-second hard alarm. Record actual run IDs, timings and results; do not substitute a smaller volume.
4. Discover and poll the exact-SHA Verify with REST within the ten-call budget and five-minute polling floor. Diagnose completed failures once per failed job if needed. Publish only selected non-secret reports and receipts to evidence/sd-spool-sdk027-7, separate from the product checkout.
5. Report the branch, SHA, CI run IDs, unchanged clause judgments, measured before/after counts and the specified claim/default/gap and terminal custody line. Delete the clone only after successful product and evidence custody; preserve recovery data on a transport blocker.

No UI creation, Base refresh/adoption, contract judgment edit, generated-view commit, PR bypass, default-branch push or provider operation is planned.

## Baseline

Fresh main: 3308d2c1 (SDK-004 feedback review). Proven carry: dce7b40c301abe897d3a6a393a11097f556ac0cb. Net SDK-027 change since e29a9f44: six files. The erasure batching and owner identity query implementation already exist in main's ancestry; the remaining diff raises archive admission, indexes identity archive membership, requires full-volume scale proof and records earlier measurements.

Acceptance summary before: Core 23 done / 45 partial / 19 missing (87); Agent surface 0 done / 9 partial / 9 missing (18). Target SDK-027 remains PARTIAL; builders do not change Status, Gap or Evidence. No test registrations added or removed by the carry.

## Candidate and preservation

Product branch: `cloud/sd-spool-sdk027-7`.
Product head: `8d26df622ca844d93cfa9d13afeb601b3765e68d`.
Parent/fresh main: `3308d2c15143af65c448e8d8494fb052adbf459e`.
One ordinary non-merge commit; `git log --merges origin/main..HEAD` printed nothing. All candidate author/committer identities are `Run Edit Run fleet <fleet@runeditrun.com>`; there are no trailers or skip markers. No PR was created. Only the declared product branch was pushed.

All five carried product/documentation/journey files equal the proven dce7b40c carry byte-for-byte. Every non-lock difference from dce7b40c is the newer SDK-004 change from main; all main SDK-004 files are preserved byte-for-byte. The regenerated lock combines the main hashes with the carry hashes. `carry-comparison.txt` lists the differences. In particular, `src/domain/erasure/end-user.ts` retains main's explanation that consented contact, screenshots and replies remain in the feedback inbox and require report withdrawal; event deletion removes reports attached to the exact deleted occurrence.

## Checks and actual results

- Setup built the actual application and applied 103 local migrations, then closed its temporary app. The repository-pinned rer remains 0.2.118; no Base refresh or adoption was run.
- `pnpm typecheck`, `pnpm source:check`, `node src/base/contract-docs.mjs check`, `node --check tests/end-user-erasure-volume.mjs`, and `git diff --check` passed. sources.lock.json was regenerated last with `node scripts/edition-authoring/cli.mjs lock`. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged.
- `tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow` passed on the candidate, using `/usr/bin/chromium` and the existing `--no-sandbox` launcher. It proves count-only owner preview, typed confirmation, authority refusals, value-free audit/receipt, retained search/tag/text handling, event deletion and old-archive fences. It saved the clause's matching, complete, unavailable and search screens at 1440 and 390; region screenshots are cropped within those viewports. `preview-results.json`, `preview-command.json`, `browser-proof.json` and the selected PNGs preserve the actual proof.
- `tests/feedback-flow.mjs#feedbackFlow` passed on the candidate, including public Sentry transport, owner reads, consented private review, safe PNG handling, member fences, mail-off behavior, populated archive restore/withdrawal and fake mail-edge outcomes with no duplicate sends. The outside-repository harness uses the committed exported journey and its usual worker/auth helpers; its source is included. Attempt 1 reached a browser launch but lacked the Chromium executable override; attempt 2 corrected only that runner environment. No assertion or product code was weakened.
- The exact candidate 150,000-event journey admitted the full corpus through public restore, reconciled public issue and identity counts, and erased through the owner preview/confirmation doors. Run `sd-spool-sdk027-7-erasure-20261117T015919Z` completed in 30.236272 client seconds (8.081 receipt seconds), below 300 seconds. Matching identities changed 150,000 to zero; retained events stayed 150,000 to 150,000. It also removed 150,000 matched search-tag and captured-text records, one issue title and one captured alert title. The complete value-free receipt explicitly retains the independently matching feedback and unsupported-copy gaps. The full restore took 287.049218 seconds, separately measured from confirmation. There was no smaller-corpus fallback. `erasure-volume.json`, `erasure-command.json` and `erasure-volume.log` carry the actual run and SHA.

All required journeys use `perl -e 'alarm 2400; exec @ARGV' --` under the cloud subreaper. Setup and browser runners use the supplied cloud toolchain. No full local verify or unrelated full suite ran.

## Counts and clause judgment

Archive event capacity before/after: 10,000 / 160,000 per project. The existing intake, payload/schema/checksum and erasure-journal guards remain separate. The carry indexes exact project/event/occurrence identity membership during archive validation.

Acceptance counts before/after are unchanged: Core 23 done, 45 partial, 19 missing (87 total); Agent surface 0 done, 9 partial, 9 missing (18 total). Test registrations added/removed: 0 / 0. SDK-027 stays PARTIAL. No Status, Gap or Evidence cell was edited, and no other clause promotion is claimed.

CLAIM SDK-027 PARTIAL points=1,3,4,5 tests=tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow; tests/end-user-erasure-volume.mjs#SDK-027 volume
DEFAULT SDK-027: Owner-only, typed confirmation, no outbound action, value-free audit.
GAP SDK-027: Ordinary search UI, independent feedback and unsupported captured copies remain.

## Transport and limits

A final main fetch and the first product push briefly rejected authentication. Only the injected bundle credential was used; refresh and the fleet Git setup were repeated. Main fetch recovered within the prescribed backoff. The product push guard succeeded on attempt 2, with identity/trailer checks repeated before each attempt. `product-push.txt` is the actual sanitized receipt. No published history was rewritten.

The cloud checked credential-shaped additions on its candidate diff. The full fleet publication scan cannot run in this cloud and remains a Mac landing gate. Evidence publication is separate from product READY, acceptance and landing. No default-branch write, self-submit, tag, release or external provider action occurred. All fixtures are synthetic.

## Completed archive proof

Run `sd-spool-sdk027-7-archive-20261117T020230Z` passed on `8d26df622ca844d93cfa9d13afeb601b3765e68d`. Public restore admitted 160,000 events in 293.267301 seconds and reconciled issue/identity counts. The subsequent whole-project archive contained all 160,000 events and all 160,000 identity rows, with matching aggregate counts; archive export took 387.473621 seconds. A valid 160,001-event archive returned `400 Archive event budget` and the fresh destination remained empty. This capacity refusal is separate from the erasure-epoch fence proved by preview. `archive-volume.json`, `archive-command.json` and `archive-volume.log` are the actual candidate-bound receipts. The complete journey finished at 2026-11-17T02:18:18.707Z under the 2,400-second alarm. No GOV-003 promotion is claimed.

## Exact-SHA CI and terminal custody

Verify run **43999610919** completed **success** on exact SHA `8d26df622ca844d93cfa9d13afeb601b3765e68d`: https://github.com/just-every/run-spool/actions/runs/43999610919 . The cloud used five GitHub REST calls total (one discovery and four status polls, at least 300 seconds apart per run). No failure-log calls, dispatch, rerun or additional workflow were needed. There is no branch-CI blocker. Product preservation has one successfully pushed head; the initial rejected push made no published save. No PR was created. The Mac's publication, landing and main/Run-site gates remain its own responsibility.

The evidence packet contains this full plan/results report, actual candidate and command receipts, complete relevant synthetic test logs, and browser proof. Only explicitly selected regular files are sent to `refs/heads/evidence/sd-spool-sdk027-7`; nothing from the packet is committed to the product branch. Clone cleanup follows successful evidence transfer. Evidence publication is report custody, not a clause judgment or a landing record.

POST lanes/sd/INBOX.md: sd-spool-sdk027-7 SDK-027 remains PARTIAL, points 1,3,4,5 claimed; no clause status changes. Linear candidate 8d26df622ca844d93cfa9d13afeb601b3765e68d on main 3308d2c15143af65c448e8d8494fb052adbf459e; 150,000-event erasure 30.236272 s (8.081 s receipt), matching 150,000 to 0 with all events retained; 160,000-event archive and 160,001 refusal passed; preview and feedback passed. Exact-SHA Verify 43999610919 success.

READY branch=cloud/sd-spool-sdk027-7 head=8d26df622ca844d93cfa9d13afeb601b3765e68d
