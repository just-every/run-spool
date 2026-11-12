# Spool setup links: current-main replay

Repository: just-every/run-spool
Branch: cloud/main-spool-setup-links-1-c1
Original round: 4c2aa83ca1b827d7c86e3b702e2cc5b2040af7ca
Baseline main: ae07f7a47522ac43a5894fdfed3918ae49f763ea

## Cause and fix

The added settingsPrerequisiteGuides fixture opened bare Settings, whose current default is Organization, then waited for Cron check-ins hidden in Issue processing. The locally inspected withheld failure was `locator.waitFor: Timeout 30000ms exceeded` at tests/setup-prerequisites.mjs:17, waiting for the Cron check-ins status; it was not a Worker, auth, provider or broken guide route failure.

The fixture now clicks the existing Settings section links: Issue processing before Cron, Alerts & integrations before Slack, and Data & archive before Business imports. Every existing assertion, guide check and timeout is preserved. No retries, sleeps, skips, assertion weakening or test registrations were added. No additional product workaround is necessary.

## Scope

The candidate retains the original round's four on-site guides and links on the first-project form, GitHub connection, Cron, Slack and Business imports, plus the identity-policy anchor. The round is squashed onto current main with the fixture fix into one commit. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain byte-identical to current origin/main. No clause status, gap or evidence is edited and no DONE claim is made. The source lock is regenerated last. Product changes contain no reports or screenshots.

## Counts

- Published docs pages: 8 → 12 (four setup guides).
- New product commits on the branch: 0 → 1 (no merge commit).
- Runtime baseline / unfixed squash / fixed candidate: pass / fail / pass.
- Target clause judgments changed: 0; six PARTIAL claims carried.
- Added test registrations: 0. Existing runtime, setup and execution journeys retain their registrations.
- Local guide proof: 4 guides, each with 11 local article/navigation links checked; 7 Settings section links and 2 legacy prerequisite anchors resolve.

## Validation

Actual command output and structured receipts are included separately. Main and the unfixed squash were each built and tested before the fixture edit. The fixed runtime journey includes settingsPrerequisiteGuides. Browser proof uses Chromium at /usr/bin/chromium with --no-sandbox. Tests assert at 1440; changed screens are captured at 1440 and 390.

The first-project helper requires the local dev entry. An initial temporary proof harness used the emitted production Worker, whose auth dispatcher correctly refuses /auth/dev/enter; its navigation timed out. That harness was corrected to use the real rer dev installation without modifying the journey or product. An initial temporary link-proof harness incorrectly expected an HTTP response for same-document fragment navigation; the harness was corrected to check the underlying Settings HTTP route separately, then assert the visible section. Neither temporary harness is committed.

Local synthetic journeys do not qualify live GitHub, Slack, egress or Business trust and no provider credentials were entered. The full publication scan and guarded landing remain owned by the Mac fleet. CI provenance, terminal SHA and final results follow in the completed receipt.

## Claims, defaults and remaining gaps

CLAIM SDK-008 PARTIAL points=5 tests=tests/setup-journey.mjs#firstProjectJourney
CLAIM SRC-002 PARTIAL points=none tests=tests/execution/ui.mjs#disconnectedGitHubSetup
CLAIM AI-003 PARTIAL points=none tests=tests/execution/ui.mjs#disconnectedGitHubSetup
CLAIM ALERT-002 PARTIAL points=none tests=tests/setup-prerequisites.mjs#settingsPrerequisiteGuides
CLAIM SDK-024 PARTIAL points=none tests=tests/setup-prerequisites.mjs#settingsPrerequisiteGuides
CLAIM MIG-001 PARTIAL points=none tests=tests/setup-prerequisites.mjs#settingsPrerequisiteGuides
DEFAULT SDK-008: Preserve the installation's existing drop default and disclose it before creation; do not adopt the contract's future keep default.
GAP SDK-008: Broader identity-policy acceptance and the future default remain unchanged; only point 5 is claimed here.
GAP SRC-002: Live repository/provider qualification remains pending.
GAP AI-003: Live provider repair qualification remains pending.
GAP ALERT-002: Live Slack and other provider qualification remains pending.
GAP SDK-024: Live integration-egress/Uptime qualification remains pending.
GAP MIG-001: Real-account migration and Business provisioning qualification remain pending.

## Product provenance

Head: 32e0d9a80a6ca4bf4d6d257ff9670ab428e3af85
Parent: ae07f7a47522ac43a5894fdfed3918ae49f763ea
One real commit, no merge, no skip-CI marker, no trailers. Named product branch pushed successfully on attempt 1; no main push, history rewrite, deployment or PR was performed. The repository has a branch Verify entry point and fleet landing does not require a builder PR.

The full pnpm test:execution journey passed, including disconnectedGitHubSetup and the existing repair/exposure/expiry flows. The firstProjectJourney passed against a real rer dev install at 1440, including keyboard flow, unchanged drop default, source-map upload, mapped admission and capture; changed setup screens were also captured at 390. pnpm test:runtime (including settingsPrerequisiteGuides), pnpm typecheck, pnpm check --profile first-party, contract-docs check and source:check all passed. No local full verify was run. All task-started server/browser processes were stopped; ignored proof harnesses and screenshots remain outside the product commit.

## Replay comparison

All 15 carried files other than sources.lock.json and tests/setup-prerequisites.mjs are byte-identical to the original setup-links branch. The fixture differs only by five added lines (comment, navigation locator and three section clicks). The lock is regenerated for the resulting current-main tree. The full plan is PLAN.md; replay-receipt.json and contract-receipt.json record these checks.

## Final CI and custody

Exact-SHA Verify run 43215360941 completed successfully on 32e0d9a80a6ca4bf4d6d257ff9670ab428e3af85, attempt 1. URL: https://github.com/just-every/run-spool/actions/runs/43215360941 . Five REST calls total (discovery included), spaced at least 300 seconds; no rerun, failed-job log download or exemption was needed. The run was still in progress at the 15-minute read and returned completed/success at the 20-minute read. CI duration is not asserted from these polling observations.

Builder blockers: none. The public-diff hygiene check, all requested local journeys, typecheck, source and contract checks passed. The Mac fleet still owns its full publication scan, independent acceptance, generated landing views and main landing/site gates. Product READY and the report-only evidence transfer are separate custody events. The clone will be deleted after evidence publication and remote-ref verification; the actual packet stays under the fleet task directory.

READY branch=cloud/main-spool-setup-links-1-c1 head=32e0d9a80a6ca4bf4d6d257ff9670ab428e3af85
