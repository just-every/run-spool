# Spool docs-truth replay

Repository: just-every/run-spool
Branch: cloud/main-spool-docs-truth-1-rb1
Head: e974d4eaef7facdbdb0843933bdb95447fe83ade
Base: ae07f7a47522ac43a5894fdfed3918ae49f763ea
Original replay source: origin/cloud/main-spool-docs-truth-1 (fa4127fe19e7a1d9428fd0b0527016ad01941898).

## Result

Exactly one product commit on current fetched main; no merge commit. Nine files changed, 85 insertions and 53 deletions. The squash applied without conflicts, so main's newer text and tests remain. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to the base; PRODUCT.json records their hashes and the exact parent. Source lock regenerated last with `node scripts/edition-authoring/cli.mjs lock`, checked and committed. No evidence, screenshots or tool scripts entered the product branch. Product branch pushed successfully on the first guarded attempt. Main and SDK publishing were not performed.

README, local instructions, capture docs and both setup components now place npm commands in the user's application repository with that application's Node.js and npm. Framework setup uses published packages and manual steps; spool-setup and Spool tunnel helpers are explicitly unreleased and conditional on a separately supplied artifact. The guide preserves seven framework sections, browser-origin instructions and Python's no-source-map boundary.

Capture and framework docs and the source-map component agree that published SDK 0.1.0's CLI prints {"uploaded":1}, needs no --json flag and refuses that unsupported flag; its Vite/Rollup plugin is silent on success. Original-source frame confirmation and stamped-output deployment remain. An independent npm registry metadata and tarball inspection still found version 0.1.0 with only the spool-sourcemaps bin, JSON CLI output and no plugin summary output. No package was published or upgraded.

RUN-LOCALLY.md and OPERATIONS.md now agree with README and HOSTED: a successful credential-free dry run exits 0 and makes no Cloudflare request; this does not establish remote readiness. Operations describes Settings organization creation, invitations, roles and project access while preserving the one installation owner, local suppressed mail and separately verified ownership transfer. Main's newer local invitation guidance elsewhere remains intact.

## Validation

All six touched checks passed on e974d4eaef7facdbdb0843933bdb95447fe83ade: static docs/site build and its repository file/anchor link validation; first-party check; tests/runtime.mjs; typecheck; contract-docs check; source lock check. CHECKS.json names each exact command, SHA, timestamp, exit code and complete output file. The application build also passed; app-build.log retains its output. Setup passed using fleet owner email and non-interactive mode; its private settings and log are excluded from this public packet.

The runtime journey follows anonymous docs navigation, all seven framework sections, source maps, Python guidance and tunnel replacement; resolves every published-document link and anchor; and compares the emitted static article to the HTTP article. It also preserves owner admission, refusal and revocation assertions. No registration was added, removed, skipped or disabled. The existing guide assertions were updated to require the published manual Next.js install/DSN and build instructions in place of the unavailable wizard-generated files; all other assertions remain. runtime-assertion-diff.txt contains the entire test diff.

Browser proof shows capture, source maps in plugin and CLI modes, and framework setup at 1440 and 390, using /usr/bin/chromium with --no-sandbox. BROWSER.json names all eight images. SDK credential examples are masked. No build-only key was created. Browsers and synthetic Worker installations were closed. The first proof helper used a nonexistent cli selector; it was corrected to the existing webpack option before final captures. This was a helper error, not a product test failure.

Local commands used the supplied toolchain shim: Node 24.19.0 and pnpm 10.12.4. The shim keeps a newer VM Node when the declared minimum (22.20.0) is already met. CI uses the repository's declared 22.20.0. No full local suite ran; exact-SHA branch Verify is the full wall.

## Counts and claims

Core before/after: 23 DONE, 45 PARTIAL, 19 MISSING, 87 total.
Agent surface before/after: 0 DONE, 9 PARTIAL, 9 MISSING, 18 total.
Full target before/after: 23 DONE, 54 PARTIAL, 28 MISSING, 105 total.
Clause status changes: none. Test registration delta: 0. Runtime assertion calls: 67 before and 67 after.

CLAIM SDK-020 PARTIAL points=5 tests=tests/runtime.mjs#framework publication journey
CLAIM SRC-003 PARTIAL points=none tests=none
CLAIM OPS-001 PARTIAL points=none tests=none
GAP SDK-020: This replay proves published guide navigation and content, not additional guided-framework or runtime qualification.
GAP SRC-003: Documentation alignment adds no new CLI/plugin compatibility qualification.
GAP OPS-001: Documentation alignment and local checks add no hosted/provider acceptance.

## Custody and remaining gates

Verify run: 43214135422, https://github.com/just-every/run-spool/actions/runs/43214135422 . Completed successfully on the exact pushed SHA. CI.json and the GH receipt files record the result.
One watcher uses REST with at least 300 seconds between calls, including discovery; GH-CALLS.json is the actual call ledger. No PR was required or created: this seed uses fleet guarded landing. The cloud cannot run the Mac publication scan; the fleet independently scans and lands after task completion. Evidence publication is separate from product readiness and acceptance.

The complete plan is PLAN.md. All selected packet files are actual non-secret reports, receipts or browser proof. The product checkout is scheduled for deletion after verified evidence transfer; the external packet and restored transfer check remain. No product blocker remains.
