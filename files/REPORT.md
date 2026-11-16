# gr-mt-spool-ci-9: no change required

Author: Run Edit Run fleet, 2026-11-16 UTC.

## Result and product custody

The historical SDK Verify failures have already been repaired on main. Existing commit e0ffb0e86e998b88838d8b20a60fa6960a8960b2 redistributes the overloaded SDK job without deleting, skipping or weakening any command or raising its timeout. The original four-suite command now passes locally, and the affected jobs all pass in exact-SHA Verify on the verified main snapshot.

Verified main snapshot and local cloud/gr-mt-spool-ci-9 head: 2011d4884e82800cccefbf4d0a7cdfa91384e47b. The task has zero product commits and zero changed product files. The branch is local only. No product push or PR was needed or performed for this no-change result; no new product tree was published and no new-product publication scan was run. No READY/PUSHED landing claim is made. The report-only evidence ref is separate transport, not a product candidate. The requested maintenance result.json is saved beside the clone and copied into this packet.

## Full plan and execution

1. Installed the launcher, decrypted-bundle Git helper, push guard, repository-preserving commit hooks and report transport. Set fleet author/committer identity. Cloned only just-every/run-spool with full commit history and created the named cloud branch from main. No credentials or private setup output enter this packet.
2. Read the launcher and repository instructions and shipped RULES. Inspected both reported completed runs through their job metadata and requested each underlying failed-job log once. Read the workflow at both historical commits through Git to identify the exact command. Compared source history before proposing any change.
3. Installed dependencies and pinned Node 22.20.0 / pnpm 10.12.4. Ran setup, built the emitted application, ran the SDK package journey and typecheck. On discovering a newer main, waited for the initial journey to finish, advanced the unpublished local branch without creating a task commit, rebuilt and typechecked, then ran the entire original four-suite SDK command against that exact refreshed head with system Chromium and --no-sandbox. No full local Verify was run.
4. Verified exact-SHA CI through REST within the ten-call budget and five-minute polling limit. Read successful affected-job receipts on the refreshed head. Identified the already-landed repair in Git and checked that it preserves the original command set and timeout. No code/test/contract fix was necessary.
5. Wrote actual report, result and receipt files outside the product tree. Retained raw non-secret API receipts, empty historical log responses, successful local output and the existing repair diff. Selected regular files explicitly for the evidence-only ref; excluded private setup output, environment dumps, credentials and held-out material.

## Historical failures and the existing repair

Run 41685000847 at 028ddd2336556da1888640216f9349b6898c2cc9 failed in verify (sdk), job 126089545405, step Run suites. Run 41637241328 at bf5b04ae4e485d92dd7fdb00924a3bb2557c62bb failed in the same job/step, job 125921896541. Their shards (spool) and verify failures are downstream aggregates.

Both historical workflow trees ran:

```
pnpm test:sentry && pnpm test:sentry:sdk && pnpm test:sdk && pnpm test:languages
```

The exact mandated log reads were:

```
gh run view 41685000847 --repo just-every/run-spool --job 126089545405 --log-failed
gh run view 41637241328 --repo just-every/run-spool --job 125921896541 --log-failed
```

Each exited 0 with zero bytes on stdout and stderr. No HTTP error/body or assertion diagnostic was supplied. Neither request was repeated. The common failing job/step is directly observed; the individual old assertion/timeout diagnostics cannot be reconstructed from these responses.

Existing repair e0ffb0e86e998b88838d8b20a60fa6960a8960b2, `ci: spread the sdk shard's commands over three verify jobs`, records measured SDK-job times of 15–28 minutes against a 25-minute cap, with test:sentry 9–18 minutes, sentry-sdk 3–6, sdk-package 1.6–2.3 and languages 1.2–2.0. These measurements come from that historical fleet-authored commit body, not a measurement or log reconstruction by this task. The diff keeps sentry-http and sentry-import in sdk; moves sentry-sdk, sdk-package and languages into tunnel; and moves business-import into execution. It preserves all commands, 13 product shard names and the timeout. The Base acknowledgement and source lock were already regenerated in that repair. Actual command provenance and the repair diff are included in historical-sdk-command.txt and existing-repair.patch.

The evidence supports an already-fixed overloaded job, not a false-positive classification or a newly invented assertion fix.

## Actual local checks

All final checks used Node 22.20.0 and pnpm 10.12.4. Browser journeys used /usr/bin/chromium with --no-sandbox through the existing browser helper. Long commands ran through cloud_run and its subreaper.

- pnpm install --frozen-lockfile: exit 0.
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive: exit 0. Private local-entry output is excluded.
- Initial snapshot e1bbf84516f3e8729b623f040ff5b68cd95f3a91: rer build, pnpm typecheck and pnpm test:sdk passed. The SDK package journey includes offline tarball installation, browser/Node/Worker capture, recursion/noise protection, 24 mapped failures from four bundlers across three releases, artifact custody/restore/erasure and refusal checks.
- Refreshed head 2011d4884e82800cccefbf4d0a7cdfa91384e47b: rer build and pnpm typecheck passed. The complete original four-suite Run suites command above passed with exit 0, including Sentry HTTP, Sentry import, Business import, real Sentry browser/Node SDK qualification, packed Spool SDK and multilingual public journeys. The actual transcript is original-sdk-step-passed.log.
- git diff --check passed. The product checkout is clean, matches its fetched origin/main exactly, and contains zero task-created commits. The required candidate identity/trailer range origin/main..HEAD is empty.

An early SDK probe before building the application failed with ENOENT for dist/server/wrangler.json under the VM's initial Node 24.19.0. This was incomplete local preparation, not a reproduced product defect. It was followed by explicit Node pinning, successful setup/build and passing checks. It does not qualify as the historical cause.

## Exact-SHA CI receipts

Initial main e1bbf84516f3e8729b623f040ff5b68cd95f3a91: main Verify 43878215357 and Run site 43878215139 completed successfully. Full exact-SHA branch Verify 43873982926 included successful SDK job 133322700026 and its Run suites step.

Refreshed verified main snapshot 2011d4884e82800cccefbf4d0a7cdfa91384e47b:

- Verify 43887905458: completed/success. SDK job 133395369384, tunnel job 133395369419 and execution job 133395369465 each completed/success, including Run suites. Build job 133395454528 and aggregate verify job 133396120756 also succeeded.
- Verify 43898515954: completed/success on the same full SHA.
- Run site 43911734441: completed/success on the same full SHA.
- Separate main-triggered Verify 43911734696: in_progress at its last permitted observation; no result is claimed. It is not substituted for the completed exact-SHA branch runs. API use finished at 10/10 calls; there were no further API reads, dispatches or reruns.

## Before/after counts and clause judgments

No clause text, status, Gap or Evidence cell changed. No generated contract view or source lock changed. No new CLAIM, DEFAULT or GAP is proposed by this maintenance result. No screen was changed.

| Count | Before | After |
| --- | --- | --- |
| Core done / partial / missing | 23 / 45 / 19 (87) | 23 / 45 / 19 (87) |
| Agent surface done / partial / missing | 0 / 9 / 9 (18) | 0 / 9 / 9 (18) |
| Full target done / partial / missing | 23 / 54 / 28 (105) | 23 / 54 / 28 (105) |
| Product claims done / partial / missing | 3 / 7 / 0 (10) | 3 / 7 / 0 (10) |
| Task-created product commits / files | 0 / 0 | 0 / 0 |
| Test registrations added / deleted by this task | 0 / 0 | 0 / 0 |

## Remaining limits and return

No product blocker remains for this historical maintenance item: an already-landed repair, successful exact-SHA affected jobs and the passing original local step justify result status no-change. The two old archive requests returned no assertion text; direct per-run root-cause reconstruction remains unavailable. The separate main-push Verify was pending at last observation. No test or timeout was weakened to resolve either limitation.

The clone and requested result.json remain at $HOME/rer-consolidation/work/maint/gr-mt-spool-ci-9/. Actual report/receipt files are under $HOME/rer-consolidation/work/gr-mt-spool-ci-9/packet/. This packet is for refs/heads/evidence/gr-mt-spool-ci-9 only; it does not request landing or imply product READY. All owned test/browser/runtime processes completed through the subreaper.

The SDK journey refreshed 20 tracked TEAM-004 screenshots. Those generated images were preserved outside the clone under work/gr-mt-spool-ci-9/generated-proof/ and the tracked baseline restored; the final product checkout is clean. They depict existing journey screens and are not a task UI change or a new clause claim.

Explicit packet review selected 20 regular report/receipt files. The selected bytes contained no injected secret values or credential-shaped matches. Private setup output and all environment/key files remain excluded.
