# Spool Capture and SDK setup truth

Task: main-spool-capture-setup-truth-1. Repository: just-every/run-spool. Branch: cloud/main-spool-capture-setup-truth-1. Base: 0f9809608a4ba84b23f4f8ece165605fcdd1acba.

## Plan and scope

PLAN.md contains the full execution plan. Reproduce current main through public browser/HTTP doors and public npm installation; inspect enforced limits; make the three scoped truth corrections; extend existing public journeys without adding registrations; test and capture changed screens at 1440 and 390; update from main, regenerate the source lock, push the named branch with identity checks and await exact-SHA Verify. Publish this packet only on the evidence ref. No installer, npm publication, upload-limit, contract Status/Gap/Evidence or generated-view changes.

## Reproduction and result

1. Current main already warned that the installer keeps Node/npm private, but lacked the prerequisite download link and offered the helper after npm on Capture and not in shared setup. The public registry returned HTTP 200 and an isolated npm install installed @just-every/spool 0.1.0 successfully. The historical total-package-unavailability claim no longer reproduces; 0.2.0 remains unpublished. Keep the working npm install, add the Node.js/npm prerequisite link at each SDK install step in setup/docs, and offer the browser helper first/beside it. Shared setup now includes the downloadable helper and a module-init example on first project, Capture and Settings. Source-map setup links the prerequisite, Capture's helper and the prepared-map option. npm-receipt.json records the actual install.

2. README and capture.md claimed a lifetime count of 20 flat maps at 256 KiB. Migration 0067 removes that count trigger; current service validation accepts bounded flat/indexed maps up to 1 MiB. The current checkout CLI supports these maps, but the published 0.1.0 CLI still refuses indexed maps and maps larger than 256 KiB. The prepared picker also refuses nonflat maps or files over 256 KiB. All use the optional project byte cap. README, capture guide, SDK readme, Capture mapping setup and Releases requirements now explain that version/door distinction consistently. No limit was changed. map-limits-receipt.json names the implementation sources; npm-cli-receipt.json records actual public 0.1.0 CLI refusals against a local synthetic edge (no provider or product state).

3. On current main, a real click of Capture test exception persisted environment=local-test. Its issue had zero sample callouts, one Upload map control and the reproducer form. The fix sends the existing spool-test marker already used by first-project setup. The existing issue/execution presentation labels the stack as Spool sample evidence and suppresses map/debug-ID requests and the reproducer form. The sample explanation now covers both built-in buttons, and Capture explains what its sample checks. Ordinary app errors retain map and reproducer controls. reproduction.json and before screenshots preserve the before state; browser-receipt.json and after screenshots preserve the changed screens.

## Tests and evidence

The existing tests/triage-journey.mjs journey now asserts the sample callout, sample frame labels, absence of map/debug-ID requests and Record reproducer, separation from an ordinary TypeError with identical frames, and continued map/reproducer guidance for that real error. No new registrations were added. The existing tests/setup-journey.mjs firstProjectJourney extends keyboard navigation through the helper download/copy and Node/npm link, checks the copied helper configuration, and masks its once-shown key in the new snippet.

The focused proof uses the emitted app, real owner admission, public project/release routes and the rendered Capture test button. It checks the sample behavior at 1440 and captures first-project setup, Capture, issue detail, Releases, map requirements dialog and Settings at both 1440 and 390. Synthetic keys are masked. No screenshot/evidence file is included in the product branch.

The first triage attempt passed the new desktop sample assertions, then timed out on the existing mobile mapped-frame step while I rebuilt its served files. That attempt is retained as triage-attempt-1.log and is not a passing receipt. A stable-build rerun is required. The first setup harness incorrectly used the emitted test Worker; its dev owner-entry redirect differs from rer dev, so it is not counted as proof. The real rer dev journey is required; running it concurrently with the triage process was correctly refused by the checkout's process guard, so it must run sequentially. No guard is bypassed.

## Counts and claims

Contract status rows before: 23 done, 54 partial, 28 missing (105 total). After: unchanged. No clause text, Status, Gap, Evidence or generated summary changed. Existing test registrations: unchanged (+0); existing journey width calls remain unchanged. Default test cap: 200; no cap raise or new registration.

CLAIM UX-001 PARTIAL points=none tests=tests/triage-journey.mjs#journey; tests/setup-journey.mjs#firstProjectJourney
CLAIM ERR-005 PARTIAL points=1,2 tests=tests/triage-journey.mjs#journey
The existing minified second-origin capture and contextual upload in the touched triage journey also prove ERR-005 acceptance 1 and 2 (generated frames with missing-map guidance, then original coordinates after upload). This is a partial proof claim only; it changes no clause status.

GAP UX-001: This round corrects setup/sample guidance only; it makes no whole-clause acceptance claim, team/device/provider qualification or DONE claim.
DEFAULT SRC-004: Preserve the service, checkout CLI, published npm CLI and prepared picker limits, documenting each enforced path and leaving unpublished SDK release custody with the owner.

## Custody and validation

Product pushed successfully on the first guard attempt: `cloud/main-spool-capture-setup-truth-1` at `1cf2ac62b7c9867db4bf14ea8c140b11dd20e804`. `git ls-remote` confirmed the exact branch/head. All candidate authors, committers and trailers (including side parents) passed the fleet check. The product checkout is clean. No PR was required or created; the fleet owns branch landing.

Validation completed:
- `tests/triage-journey.mjs`: exit 0, 22 check groups and 101 JPG captures at the existing 1440/390 widths. The new sample assertions execute at 1440. The stable-build rerun passed the prior mobile step.
- `tests/setup-journey.mjs#firstProjectJourney`: exit 0 through the real `rer dev` public entry at 1440, including the helper keyboard/copy checks and existing map/capture flow. The runner stopped only its own dev child by PID.
- `pnpm typecheck`: exit 0.
- `npx -y @runeditrun/rer build` through `cloud_run`: exit 0 on the final source tree.
- `node src/base/contract-docs.mjs check`: exit 0, current documents, zero prose errors/warnings.
- `node scripts/edition-authoring/cli.mjs lock` followed by `pnpm source:check`: regenerated lock; check returned `ok: true`. No generated acceptance/claims view was committed.
- Final browser proof on the pushed, clean head: 16 screenshots covering setup, Capture, issue, Releases, map requirements dialog, Settings, and the rendered Capture and Framework setup guides at 1440 and 390; all fit without page overflow and emitted no page errors. Sample callout count is 1; Upload map and Record reproducer counts are 0. The helper download returned HTTP 200; the official Node prerequisite link returned HTTP 200. docs-browser-receipt.json confirms both public guide routes, their Node prerequisite links and the actual no-Node browser-helper fragment at the pushed SHA, with no overflow or page errors.

The local journeys ran the uncommitted product changes rooted at the base; their actual manifest retains that base label. validation-receipt.json binds the final product diff, and browser-receipt.json names the exact pushed SHA. Branch CI must independently verify that exact SHA. No full local Verify was run, as required. Exact-SHA Verify run 43385482074 completed with success on 1cf2ac62b7c9867db4bf14ea8c140b11dd20e804: https://github.com/just-every/run-spool/actions/runs/43385482074. Five GitHub calls were used, with at least 300 seconds between calls. No failed-job logs or reruns were needed. CI uses one watcher with no less than 300 seconds between calls. The first discovery response was unusable because task-side URL redaction truncated compact JSON; JSON is now redacted structurally, and the next discovery waited the full interval. No CI conclusion is inferred from that response. The complete report packet is published separately to refs/heads/evidence/main-spool-capture-setup-truth-1, including this final CI receipt. The terminal EVIDENCE line names the exact final report head; evidence transport never grants product acceptance or landing. Product READY/PUSHED custody is separate from report transport. To replay the standalone browser proof, place packet file browser-proof.mjs under .artifacts/ in a checkout of the reported product head, build that checkout, then run it with RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium through cloud_run. It uses only synthetic project data and its own temporary Worker/browser, and masks the once-shown local key. The private rer dev output and setup files were excluded from this packet. The fleet Mac runs the full publication scan and owns landing; this cloud never pushes main.

## Terminal result

No blockers. The candidate is READY on cloud/main-spool-capture-setup-truth-1 at 1cf2ac62b7c9867db4bf14ea8c140b11dd20e804 after exact-SHA Verify success. No PR was required or created. No source-map limits or installer behavior changed; npm publication remains the owner’s separate release step. Contract clause status counts remain 23 done, 54 partial and 28 missing (105 total). No DONE claim or status edit was made. The product branch contains 14 product/doc/test/lock files and no evidence files. The successful product and evidence publication allow the clone to be deleted; the packet and publication receipts remain under the fleet work directory.
