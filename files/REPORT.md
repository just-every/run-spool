Verdict: five independent builder slices are worth queuing; 82 recorded open clauses / 5 held / 71 hard / 6 cheap qualification-only clauses.

Audited `just-every/run-spool` public main at `337a4cacd736ad172f397f318bb766fa5402ed9a` (0.7.14), 17 November 2026. The remote main recheck returned the same SHA. Read `AGENTS.md`, `CONTRACT.md` Status/Gap/Evidence, generated `ACCEPTANCE.md`, `docs/CLAIMS.md`, rulings, relevant source and tests, all 873 fetched `cloud/*` refs and recent main history. Status is 23 done, 54 partial and 28 missing; this report preserves all judgments. Homepage claims remain 3 done and 7 partial. No product changes, commits, pushes, PRs, CI dispatches, deployment or ready/landing signal occurred.

Counts classify whole recorded open clauses by their remaining work: HARD means cross-subsystem/dependent acceptance or migration; CHEAP here means bounded proof reconciliation already owned by an sd scope, not six new product builds. A HARD clause can contain a small independent builder slice. HELD-EXTERNAL applies to a specific remaining outside dependency, not a waiver. Physical devices, buyer accounts, named clients, screen reader and VPAT remain the contract's field-proof register and cannot alone block DONE. Source assertions read in this planning run are not newly passing runtime tests.

`node src/base/contract-docs.mjs check` passed (0 errors, 0 warnings); `node scripts/agent-door/surface.mjs --check` passed; product worktree and index remained clean. Full product Verify and runtime/UI/device/provider journeys were not run. Every reference below is relative to the audited SHA. A1 etc. are the clause's exact numbered acceptance points; the packet's `clause-inventory.json` also preserves every open clause's complete verbatim acceptance, recorded Evidence and Gap beside these findings.

**Avoid duplicate work.** 574 of the 873 extant cloud refs are not ancestors of main. A surviving ref does not establish that a round is still running: old/rebased refs persist. The packet records all refs and computes sd changed-file scopes. Conservatively reserve unlanded feature scopes; inspect their actual diffs rather than equating an old branch name with missing product code. Main already contains 3308d2c (SDK-004 private feedback) and 8d26df6 (SDK-027 scale), with additional November identity/transaction/native-debug work. Do not requeue those products from stale Status text.

Reserved scopes include sd c-f6/f21-fix1 (br/zstd shared decoding, including Python Brotli), f14 (Spool sessions), f16/f20/f4 (attachments/record APIs), f18/f5 (aggregate/automatic retention), f27 (unsafe setup-answer path), f86/f90 (real-member assignment), f89-split1 (personal email delivery/unsubscribe/digests), f95 (Slack alternate follow-up), f102/f112/f118/f125 (user counts/priority search), f113/f166/f168 (fidelity), f179/f181/f188 (suspect packets), and existing Base protocol/role/policy/audit/replay rounds. SDK-004-1/2/3 and SDK-027-4/6 are earlier related refs; linear main successors must be inspected before proposing more work. No builder may edit CONTRACT Status/Gap/Evidence, regenerate ACCEPTANCE/CLAIMS judgments, or perform a promotion. The local feeder alone updates the lane plan.

**All 82 clauses not DONE.** Each row names what is actually unbuilt or unqualified, and corrects the recorded gap where current source/tests already cover it. Existing assertions are evidence to review, not permission to promote. Whole-clause HARD rows state their coupling or prerequisite; all five queued slices below are narrower than their parent obligations.

| Clause | Class | Exact open acceptance scope and source/test reconciliation |
| --- | --- | --- |
| `ERR-005` | HARD | A1–5's second-origin browser map outcomes already have assertions. The remaining requirement is SRC-004 capacity/lifecycle/source fetching; the '30-coordinate bound' is stale: `src/domain/sentry/mapped-frames.ts` and `tests/mapped-frames-flow.mjs:17–52` page all 1,000 frames. No new paging builder. |
| `ERR-010` | HARD | A1–2 exist for the named implemented Worker journeys and 1440/390 states. A3 still needs every supported runtime's D-5 run and every configured provider's sandbox/official-schema journey. This spans the unfinished capture/integration clauses; physical-device and buyer-account field rows are separate. |
| `OPS-001` | CHEAP | A6, unsafe setup-answer-path refusal, remains unasserted on main's public command journey; `.dev.vars` symlink refusal in `tests/commands.mjs:34` is a different path. A1–5,7–8 have source/tests; `tests/owner-editor.mjs` covers editor authority. Reserve A6 to sd c-f27; no duplicate builder. |
| `TEAM-002` | HARD | A1 needs revision-exact connected CODEOWNERS, overlapping/fallback rules and accountable real-member/team assignment plus destination. A2–3 need one due/unowned notice after the configured window; A4 needs departure-safe reassignment/history. `operators/policies.ts:12–18` still calls assignment a label, not an account or notification; `tests/operator-flow.mjs` proves only labels. Reserve real-member assignment to sd c-f86/f90. |
| `TEAM-003` | HARD | A1's discussion/mention/subscribe, A3–4 release recurrence, A5 suppression forecasts/deadlines, A6 stale decisions and A7–8 priority now have source/assertions in `discussion/`, `recurrence/`, `suppression/`, `issue-priority/`, `tests/discussion-flow.mjs` and `tests/bulk-triage-flow.mjs`. Remaining: real member/team bulk assignment and A2's exact next-release policy behavior. `recurrence/model.ts` deliberately leaves next resolution waiting above its boundary; do not silently reinterpret that conflict. Preserve existing sd d1/f32 scopes. |
| `TEAM-005` | HARD | A1 email settings are built (`notifications/`, `tests/notification-preferences.mjs`). A1 personal Slack DM/Teams chat, A2 exact chosen delivery for assignment/comment/mention/resolution/regression/alert/commit-matched deploy/weekly report, and A3 next-message unsubscribe remain. Also assignment/team/bookmark reasons, actor exclusion, mandatory-rule disclosure and personal calendar digests. Reserve email delivery/unsubscribe/digests to sd c-f89-split1. |
| `SDK-002` | HARD | A1 crash/hang/offline-relaunch apps; A2 unmodified native build upload matrix; A3 deobfuscated one-issue/no-duplicate-session and mismatch diagnostic; A4 Electron minidump symbolication; A5 40 MiB dSYM and next ProGuard map remain incomplete. `native-symbols/` and `tests/bugsnag-cutover.mjs` now store bounded Mach-O/ELF identities and support ProGuard; storage is not native decoding. Simulator/emulator jobs are engineering work, not physical-device holds. |
| `SDK-003` | HARD | A1 browser/server instrumentation toggles and A2 automatic secret-safe occurrence timelines remain incomplete. A3 configurable scrubbing and A5–6 Python local defaults/custom rule already exist (`scrubbing/`, `tests/scrubbing-flow.mjs`, `tests/runtimes/python.mjs`). A4 still needs the full event/span/log projection matrix; existing scrubbing proofs do not imply span storage. Browser and Node SDKs still offer explicit breadcrumbs only. |
| `SDK-004` | HARD | A6 independent Spanish widget is unbuilt; A1's ordinary unmodified Sentry screenshot/contact and mobile path, broader A3 abuse qualification and identity-based selective feedback erasure remain. Stale gap: explicit-consent 128 KiB PNG/contact, assigned-team private review, approved reply states, bounded attempts and A4 withdrawal now exist in `feedback/private.ts`, `feedback/review.ts`, `tests/feedback-flow.mjs`; A5 description-only Sentry association is built. Main 3308d2c carries sd-sdk004-4. Do not rebuild private review/replies. |
| `SDK-005` | HARD | A1 still needs mobile/device cohorts, Spool SDK sessions and the complete sampling/offline/runtime matrix. A2 needs about-20%-of-devices adoption with comparable crash-free session/user rates and confidence; observed session share is not device adoption. A3 rollback comparison is unproved. `sessions/health.ts` and `tests/session-flow.mjs` provide observed browser/Node rates, not those cohorts. Backpressure exists; idle aggregate expiry/replay-dedup gaps remain. Reserve SDK session/aggregate-retention work to sd c-f14/f18. |
| `SDK-007` | HARD | A1 all-runtime compression/size; A2 full session reconciliation; A3 full chains plus waterfall/profile/log/replay; A4 screenshots/permissions; A6 CSP issue and minidump; A8 replay-only backpressure remain incomplete. A5 discards and A7 statsd/unknown diagnostics have assertions. Stale: bounded transactions now persist (`sentry/transactions.ts`, `tests/alerts-metric.mjs`), but no trace waterfall/profile/replay follows. Reserve diagnostic isolation and transport work to sd c-f54/f57/f59 and c-f6/f21. |
| `SDK-008` | HARD | A1 five affected users using two trustworthy `{{auto}}` visitors is unproved; Worker peer-address trust has no authenticated ingress. A2–4 four-field keep/hash/drop conversion exist; broader fields, session DID policy and shared stream/cohort figures remain incomplete. A5 creation policy display is already built in `ProjectForm.tsx` and `tests/setup-journey.mjs:30–48`. The stale all-drop/new-project-default gap contradicts `identities/policy.ts`: new projects explicitly keep four fields; legacy/missing policies stay drop. Preserve this behavior; do not invent a new ruling. |
| `SDK-026` | HARD | A1 issue-list `user.email` search and five-key facets, A2 collaborator counts with values hidden, A3 hash raw-email search finding nothing, A4 named dropped-field unsearchability and A5 every egress's count-only projection require completion. `investigation/query.ts:41` currently rejects user predicates. New owner-only erasure `identity-search` in `identities/search.ts` deliberately matches raw input to private hashes; it is not this investigation door and must stay separate. |
| `SDK-027` | HARD | The 'no implementation' gap is stale: `erasure/end-user.ts`, `identities/erasure-*`, `tests/end-user-erasure-preview.mjs` implement A1 count-only preview, supported A2 removal, A3 value-free receipt/audit and A4 archive fence. `tests/end-user-erasure-volume.mjs` plus `docs/OWNER-ERASURE.md` record a prior-candidate 150,000-event A5 run, 24.681905 client seconds, and 160,000-event archive proof. Still open: independent feedback-contact/screenshot/reply matching, uncorrelatable/ambiguous/grouping-sensitive retained copies and wider derived custody. Recent sd-sdk027 work is already on main; no duplicate scale builder or fresh measured-pass claim. |
| `SDK-009` | CHEAP | No new implementation for A1–8 identified: `tests/runtimes/node.mjs` already asserts the supposedly absent release-less/SHA new-issue alerts and named no-release scope; `tests/release-identity-flow.mjs` covers resolution/order. This is stale citation/qualification work, reserved to sd c-f185/f189/f190; no Status-edit builder. |
| `SDK-010` | CHEAP | A1–3,5–8 largely have existing fidelity/runtime/clipboard assertions. A4 Node/Java root labels are built (`tests/runtimes/chain-proof.mjs`); the stale blanket root-label gap must not generate another implementation. Full unmodified Next.js cause-chain and Python TaskGroup/Related Exceptions plus every listed storage/export/context assertion still need exact qualification reconciliation. Reserve to sd c-f113/f166/f168/f34; no duplicate fidelity builder. |
| `SDK-011` | HARD | A1 Brotli Python; A2 complete br/zstd/chunked/default-encoding matrix; A3 900 KiB event; A4 mobile 2 MiB hierarchy, 5 MiB minidump and near-10 MiB replay; A5 isolated 1.5 MiB refusal with valid companion/counting; A6 >200 MiB expansion bound; A7 lowered attachment-cap isolation remain incomplete. Main `wire.ts` permits only identity/gzip/deflate at 256 KiB compressed/1 MiB expanded. Crucially sd c-f6 and c-f21-fix1 already implement br/zstd transport; exclude that tempting duplicate. |
| `SDK-012` | HARD | A1 PHP Q6 remains unproved: pinned PHP fixture declares no client_report or discard expectation (`tests/runtimes/php.mjs`). Ruby Q6 is already asserted by `tests/runtimes/ruby.mjs` required client_report and exactly two before_send discards, contradicting the recorded gap. A2–8 have retained Python/Java journeys; reserve Ruby/fidelity qualification to sd c-f39/f194/f199 and current runtime-CI rounds. No synthetic PHP report should impersonate an SDK emission. |
| `SDK-014` | HELD-EXTERNAL | A1 Unity player Q1–Q7 is unbuilt. The specific prerequisite is an activated Unity license for the named CI job. Licensing/CI setup remains engineering work; no DONE waiver. |
| `SDK-015` | HARD | A1 Cocoa Q1–Q7 with replay/feedback/attachments, A2 next-launch crash and A3 native default release/release-less counts are unbuilt. Named macOS simulator job, app fixture, symbols and intake qualification cross SDK-002/007/011; a physical device is only field R-1. |
| `SDK-016` | HARD | A1 Android emulator Q1–Q7 with replay/feedback/attachments and A2 native default release/release-less counts are unbuilt. Android job and native capture/decoding are engineering work, not an owner-account excuse. |
| `SDK-017` | HARD | A1 React Native iOS+Android JS/native Q1–Q7 and A2 default release/release-less counts are unbuilt; two build systems plus Hermes/native intake and symbols make this cross-subsystem work. |
| `SDK-018` | HARD | A1 Flutter iOS+Android Dart/platform Q1–Q7 and A2 default release/release-less counts are unbuilt; coupled mobile builds, symbol processing and intake qualification. |
| `SDK-019` | HARD | A1 shared KMP module Q1–Q7 on JVM/Android and iOS is unbuilt; native/server targets and their category/symbol qualification must agree. |
| `SDK-021` | HARD | A1–2 bounded tunnel/block-list engine proofs exist in `tests/tunnel-flow.mjs`; a real blocker-extension run remains unqualified in existing sd f111/f120 scope. A3 genuine dual-run reconciliation and A4 authenticated trusted-tunnel positive/spoof-refusal proof remain. RL-101 already states the trust rule; no new owner decision to trust arbitrary headers. Reserve transport decoder work to sd f6/f21. |
| `SDK-022` | HELD-EXTERNAL | A1 first-party subdomain ad-blocker delivery and A2 dual-run reconciliation are unbuilt. Need the owner-delegated DNS zone/hostname for an authorized hosted TLS endpoint. DNS/TLS automation can be engineered meanwhile; no hosted claim from a local alias. |
| `SDK-024` | HELD-EXTERNAL | A1's real connected heartbeat receipt requires an actual compatible Uptime installation/heartbeat endpoint. A2 unrouted counting and Node trace-link proof exist (`tests/checkin-flow.mjs`, `src/domain/checkins/` source and `tests/sentry-sdk.mjs` integration); Python trace association remains source-only, and Go/Elixir emit no trace to join. A recorded receiver double is not a real Uptime receipt. |
| `SDK-025` | HARD | A1 remains a rerun matrix over every runtime and every newly stored category. Existing browser/Node and Java/.NET feedback/discard proofs do not qualify mobile or all sessions/traces/replay/attachments. Bounded transactions now store; complete waterfall/profile/log/replay persistence does not. Reserve existing sd feedback/runtime qualification slices. |
| `FIND-001` | HARD | A1–3 core search/review/views exist but shared teammate qualification remains; A4 user-email search/facets and A5 affected-user filtering/sorting remain. A5 priority ordering is already built (`tests/priority-search-flow.mjs`); A6 tag/inner-cause search exists. Reserve priority/review/user-count scopes to sd f112/f118/f125/f38/f102; new SDK-026 identity predicates are a separate bounded entry. |
| `FIND-002` | CHEAP | A1–5 native known-set counts, retained-event navigation, Python detail and clipboard have public assertions (`src/domain/investigation/impact.ts`, `tests/runtimes/python.mjs`, `tests/fidelity-flow.mjs`). Remaining requirement edge is trustworthy automatic session attribution and broader SDK/device cohort qualification; `sessions/health.ts` and native issue impact honestly report unavailable without an event-sent session id. Do not fabricate links or rebuild the five existing native outcomes; reserve sd d2/f36/f42/f45. |
| `SRC-001` | HARD | A1–2 real GitHub Actions/GitLab CI and complete bundler/CLI/plugin native-symbol matrix; broader A3 deployment/retention scope checks; A5 every required map for successive production Next.js/Hermes releases remain. Current packed plugins, missing-map A4 and bounded repeated uploads exist (`source-map-builds.ts`, `tests/sdk-package.mjs`). CI/provider matrices and artifact capacity cross SRC-003/004. |
| `SRC-002` | HARD | A1 provider grants on all three hosts, A2 changed-source suspect explanation, A3 exactly-one PR/MR comment, A4 immediate grant revocation, A5 automatically derived mappings and A7 connected citations/full-SHA association remain. A5 manual mappings/A6 explicit unmapped reasons exist (`source-map-path.ts`, `src/domain/repository-links.ts` and `tests/repository-source-flow.mjs`). Current links are unverified; official-schema adapters can be built before field R-10 accounts. |
| `SRC-003` | HARD | A1–2 complete GitHub/GitLab CI, Next.js/Gradle/Xcode/Fastlane/React Native/Dart and symbols; A3 three production-sized Next.js/Hermes releases remain. Connected --auto/--commit depends on SRC-002. A4 unknown flags, A5 deploy authority and A6–7 native release enrichment/citations are already tested in `tests/sentry-cli-compat.mjs`; reserve sd f48/f74/f77 and source CLI rounds. |
| `SRC-004` | HARD | A1–4 production Next.js/Hermes, >2 MiB vendor/50 MiB maps and 40 MiB dSYM; A7 automatic unused-map expiry; A8 allowed-origin source fetch/private-network refusal remain. A5 no lifetime count and bounded A6 byte-cap diagnostics exist. Indexed/sourceRoot maps are bounded, not 50 MiB proof. Expanded frame paging is already built; reserve picker parity/retention to sd f2/f5/f18. Large/streamed artifacts, native decoding and SSRF-safe fetching are separate hard work. |
| `REL-002` | HARD | A2 audited false-suspect rejection and A1 first/reactivated candidates/deployment-window/observed same-window rates are built (`suspects/`, `tests/suspect-flow.mjs`). A1 still lacks comparable device/OS adoption cohorts and changed-source matching/rate attribution. Packet provenance remains in sd f179/f181/f188; AI-006 learning is separate. Correlation cannot become causation. |
| `CTX-001` | HARD | A1 complete OTel/Sentry waterfall/log/profile chain, A2 p75 LCP/CLS, A3 Datadog/Splunk context with revoked forwarding and A4 trace-variant grouping comparison are unbuilt/incomplete. Stale 'traces/metrics all refused': bounded Sentry transaction duration storage and p95 metric rules now exist (`sentry/transactions.ts`, `tests/alerts-metric.mjs`), while trace identity/spans/profile are still absent. OTLP logs remain bounded. |
| `CTX-002` | HARD | A1 native recorder plus unmodified Sentry browser/mobile replay at the error time; A2 masking in storage/export; A3 revoked access and erased playback/artifacts are unbuilt. Recorder, category storage, player, consent, retention and erasure span subsystems. |
| `CTX-003` | HARD | A1 links at error time for PostHog/LogRocket/FullStory/Datadog; A2 permission-revoked refusal; A3 zero replay content in Spool storage/export are unbuilt. Provider identity and entitlement-aware links need four adapters; live accounts are field R-14, not a reason to skip official-schema work. |
| `CTX-004` | HARD | A1 five performance detector cases across Sentry/OTel/React Native, A2 alert/assignment, A3 changed threshold and A4 fixed-release/regression behavior are unbuilt. Bounded transaction metrics are not performance issues; detectors depend on trace/span intake and TEAM-002 ownership. |
| `ALERT-001` | HARD | A1–5 historical/burst/seasonal/low-traffic/loss, user/session thresholds, dropped-identity refusal and plain-resolve regressions already have assertions (`tests/alerts/baseline-journey.mjs`, `conditions-journey.mjs`, `plain-resolve.mjs`). Stale gap says those baselines/rich filters are absent. A6 still needs unmodified Sentry transaction p95 AND page LCP warning/critical/recovery transitions; constructed transaction p95 exists in `tests/alerts-metric.mjs`. No duplicate anomaly engine. |
| `ALERT-002` | HARD | A1–2 Discord, Teams, Oncall and PagerDuty connection/test/trigger/link; A3 chat/paging actions; A4–5 new-provider credential rotation/revocation and no-duplicate histories remain. Email, signed generic webhook and native Slack exist (`alerts/slack*.ts`, `tests/slack-flow.mjs`); reserve Slack alternate follow-up to sd f95. Each new channel inherits reviewed tests and ALERT-004 custody. |
| `ALERT-003` | CHEAP | A1–6 current-channel test/review, unchanged evidence, US-timezone digest, snooze resumption and loss/backlog have assertions (`tests/alerts-runtime.mjs`, `tests/alerts-ui.mjs`). Broader channel coverage grows with ALERT-002/005. The recorded real-bounce/complaint gap is field proof R-9, not missing native transition code or a reason alone to hold DONE. No builder for owner-supplied production events. |
| `ALERT-005` | HARD | A1 Slack/Teams resolve/archive/assign with message+timeline+audit parity; A2 linked-role refusal; A3 access-safe unfurl; A4 PagerDuty/Oncall two-way transitions; A5 signature/replay exactly-once are unbuilt. Coupled inbound authentication, membership mapping, outbound update and loop prevention; official-schema fixtures can be built without live tenants. |
| `TRACK-001` | HARD | A1 one ticket on repeated create in Vector/Jira/Linear; A2 bidirectional resolve/reopen; A3 Jira assignee/comments; A4 Jira alert action; A5 stale/forged callback; A6 visible conflict; A7 disconnect fence remain. `repairs/routes.ts`/`tests/repair-recovery.mjs` provide manual links only. Native adapter/callback/conflict work is hard; actual Vector endpoint and live tenants are separate owner asks. |
| `MIG-001` | HARD | A1 full collection/count/byte/loader-key mapping, A3 complete source samples/rules/filters, A4–6 real category/release/health burst dual run and cutover remain. A2 resumable apply and bounded A7 losses/guarded undo are built (`sentry-import/`, `tests/business-import.mjs`). Also missing incomplete/unreadable import-custody erasure, compact matchesMany/large reconciliation and browser upload/review/apply/reconcile. Synthetic 2 MiB/500-record proof is not real organization proof. |
| `MIG-002` | HARD | A1 reviewed Datadog mappings/exceptions, A2 issue/event/history/monitor-rule reconciliation and A3 service dual run/cutover without replay/duplicates are unbuilt. Import-kit adapter, lineage, resume/undo and monitor conversion make this migration work, not a credentials-only hold. |
| `MIG-004` | HARD | A1 full collection mapping remains beyond bounded synthetic samples. A2 Apple/NDK native decoding and native cutover remain; A3 unavailable historical denominators is built. Stale blanket 400 dSYM-upload gap: `native-symbols/debug-upload.ts` and `tests/bugsnag-cutover.mjs:65–84` accept bounded UUID/build-id files with immutable replay but explicitly unsupported symbolication. R-5 real buyer proof remains separate. |
| `MIG-005` | HARD | A1 representative error/lifecycle mappings and count/link reconciliation, A2 capture cutover and A3 idempotent resumed inactive history are unbuilt for each PostHog, GlitchTip and Better Stack. Three import adapters plus lifecycle/cutover proof; no owner export needed to begin documented-format fixtures. |
| `API-001` | HARD | A1 complete release/session/audit/attachment pagination; A2 permitted/refused Sentry screenshots; A4–6 streaming large-query/JSON/private-archive export and 160,000-event full reconciliation remain. Scoped occurrence/feedback records exist (`investigation/records.ts`, `tests/records-flow.mjs`). Archive validator now admits 160,000 events, so the old 10,000 archive sentence is stale; this is not a streamed JSON export proof. Reserve attachments/session records to sd f16/f20/f4. |
| `API-002` | HARD | A1 complete /api/0/ issue-search/cursor/assign/bulk-resolve script and A2 unmodified Terraform plan/apply/import/no-change re-plan are unbuilt. A3–4 only current deploy-key release/deploy/upload doors have named refusal/authority tests; broader endpoint/token-role mapping and nested-field validation remain. Reserve selected top-level field refusals to sd f119. |
| `GOV-001` | HARD | A1 step-up beyond native successor handoff, A2 documented recovery, A3 Google+GitHub member sign-in and A4 verified-domain refusal remain. Organization SSO/SCIM and auth policy must share native role/revocation fences; `tests/governance-step-up.mjs` is not enterprise SSO. Native successor/transfer proofs are in sd f110/f117/f122/f165; provider tenants are field R-15. |
| `GOV-002` | HARD | A1–2 per-project windows and held export/cutoff are built; A3 automatic artifact/session-aggregate cutoff, A4 actual storage cost rather than estimated text bytes, and complete A5–6 post-cutoff fences/automatic expiry remain. Residency/subprocessor declarations and commercial longer windows remain. Reserve aggregate/retention fixes to sd f18/f5; do not conflate legal hold with erasure. |
| `GOV-003` | HARD | A1 60,000/month+5,000/minute default/off spike runs; A2 spike-only refusals; A3 >160,000 continued intake; A4 >10,000/minute server-rate-limited accounting; A6 monthly-budget-only refusal; complete A7 streamed export/restore and A8 project-erasure volume/timing remain. A5 bounded automatic event expiry exists. SDK-027's prior 150,000 erase and 160,000 archive are partial A7–8 evidence only. `admission.ts:74–81` still refuses 120/minute and 10,000 retained; do not merely delete guards without atomic rate/budget/search/archive replacements. |
| `BILL-001` | HARD | A1 USD forecast/reconciliation; A2 warning/monthly/spike caps and notice; A6 oversized-item no-quota outcome; A7 sampling-loss preview; A8 monthly-only refusal/no retained cap remain. A3–4 filtered/client-discard accounting and A5 independent DSN key limit already exist (`key-rate-limits/`, `tests/key-rate-limit-flow.mjs`); recorded 'key limits absent' is stale. Pricing ruling needed before monetary claims; quota/spike engineering can proceed with explicit units. |
| `BILL-002` | HELD-EXTERNAL | A1 buyer-controlled billing sandbox invoice with tax and cancellation is unbuilt. Need an owner-authorized Stripe/billing-partner sandbox and approved USD/tax/terms configuration; public plans cannot invent commercial terms. |
| `UX-001` | HARD | A1 full real-member assignment/release/feedback/repair path and all target state coverage remain; A2 native revoked/offline recovery already exists. Stale single-owner-only claim is contradicted by `tests/team-browser.mjs`, `tests/team-viewport.mjs` and `tests/triage-journey.mjs` at 1440/390. The full journey depends on TEAM-002 and other unfinished doors; human screen reader/VPAT are field rows, not builder tasks. |
| `AUDIT-001` | CHEAP | A1 portable safe chronology and A2 no secret/erased identity already have assertions (`tests/audit-history.mjs`, `tests/team-flow.mjs:271–307,387–392`, owner/project erasure tests). New member/service denials, committed member triage and inert restore exist, contradicting 'member actions not asserted'. Remaining work is exact complete-action coverage reconciliation/D-1 for future features; reserve sd f295/f328/f332, never a Status-edit builder. |
| `INT-001` | HARD | A1 both providers' preview/production deploys/artifacts, A2 mapped-error link, A3 failed/rollback, A4 callback idempotency and A5 disconnect/erase/old-callback fencing are unbuilt. Signed adapter, least-privilege read-back and durable reconciliation span deployment and artifact stores; real accounts are field R-12. |
| `BASE-AGENT-001` | HARD | A1–6 native transport have explicit protocol fixtures; remaining full registry/hosted qualification and resources/prompts exposure are unproved. Resource/prompt implementations exist but `agent-door/index.server.ts:32` does not declare those capabilities, so transport serves neither. Do not enable a capability just to make the inventory count pass; reserve sd protocol/adoption rounds. |
| `BASE-AGENT-002` | HARD | A1 full Core-clause/not-a-tool coverage, A2 every output schema, A3 annotations, A4 refusal parity, A5 every UI/tool state+audit parity and A6 embedded-agent common registry remain table-wide unjudged. `catalogue.mjs` and native tools are implemented, not an empty seed. Existing sd f304/f315/f319/f322 own annotation/docs/subset checks. |
| `BASE-AGENT-003` | HARD | A1 complete served templates, A2 role-parity fields, A3 uniform missing/scope refusal, A4 write resource-link readback, A5 byte budget/no partial content and A6 untrusted metadata remain unqualified. `resources.ts` is present but resources capability is off; byte-budget grant model is absent. Requires shared door/native resource/authority changes. |
| `BASE-AGENT-004` | HARD | A1–7 remain unjudged as a full seed adoption: metadata/trusted scopes; correct/sibling audience; expiry/max lifetime; all-needed-scope challenge; query-token refusal/no logging; seed/Business consent revocation; unpair/native-sign-in. Subsets exist in `tests/agent-door/people.mjs`, consent retirement in `tests/agent-door/people.mjs`, protocol/continuation tests; reserve sd f297/f301/f325. Actual sibling/Business control-plane proof requires the corresponding host. |
| `BASE-AGENT-005` | HARD | A1 every-tool role parity beyond issue/triage; A2 resource-folder and byte/spend budgets; A3 suspension variants; A4 own-scope narrowing plus exact self_escalation on policy/Pause/grant widening; A5 broader imports/files/mail/other-seed injection remain. Current sponsor downgrades and captured-record injection are qualified (`sponsor-role-contract.mjs`); shared Principal has no resource budget. Reserve sd f313/f317/f320/f324. |
| `BASE-AGENT-006` | HARD | A1–5 full contract-table class parity, per-tool facts/injection fixtures, amount/counterparty/direction/count and invalid-class rer-check; A6 refusals outside the tested live-suppression slice remain. `classification-audit-contract.mjs` proves only native suppression refusal. Depends on SURFACE-002–004 classifiers; no static flag-based class substitute. |
| `BASE-AGENT-007` | HARD | A1 every tool/class/disposition; A2 upgrade-unanswered-class availability; A3 money thresholds/daily rules; A4 stricter combined disposition; A5 complete approval expiry/change/reject flow; A6 all-door equality; A7 next-revision audit; A8 bad-signature/foreign-Business last-valid revision need complete table-wide qualification. Current setup/policy/approval fixtures exist; reserve sd f169–176/f305/f307/f308. Provider spending and full registry remain hard gaps. |
| `BASE-AGENT-008` | HARD | A1 confirmation-injection invariance, A2 agent-token person-door refusal and A3 form accept inertness exist; A2 native device lifecycle remains absent. A4 every record/activity/export/certificate, A5 broader preparer/approver acts, A6 all 1440/390 projections and provider-gated handoffs remain incomplete. Existing mail-edge A7 attribution is not live buyer delivery. Reserve sd f308/f312 and shared door work. |
| `BASE-AGENT-009` | HELD-EXTERNAL | A1–7 current native audit/write/refusal/count/review/export/retirement/screens have assertions (`audit-contract.mjs`, `audit-retirement-contract.mjs`). Requirement-wide all-registry audit remains SURFACE-001; the specific outside prerequisite is Business's cross-seed audit/review/removal host and authority. Seed-only native retirement cannot prove Business-wide removal. Reserve existing sd f306/f309/f310/f316. |
| `BASE-AGENT-010` | HARD | A1 <=10-second subscription; A2 same webhook/events.list ids; A3 ordered cursor replay; A4 delivery-time revoked authority; A5 visible retry/no duplicate effect; A6 permission-safe approval/review/policy event facts are unbuilt/unqualified. Events/subscriptions are not declared by the current door; event log, webhook custody and authorization must join. |
| `BASE-AGENT-011` | HARD | A1 rate Retry-After; A2 fourth-recipient daily-rule fallback; A3–4 spend-cap/no-cap/zero-spend behavior; A5 per-agent money/provider usage and A6 actual Business/device/all-mode Pause remain. A6 native/signed-pause admission and A7 agent-cannot-resume exist (`pause-contract.mjs`). Shared door README explicitly leaves spend reservations unimplemented; reserve existing cap/pause sd rounds. |
| `BASE-AGENT-012` | HARD | A1–5 complete every-write replay, dropped-stream recorded outcome, argument conflict, current-revision conflict and foreign job-handle refusal remain unjudged table-wide. Native `idempotency`, replay-horizon and sponsor-bound job fixtures already exist; reserve sd f299/f303/f326/f327. Do not treat one working proposal tool as full adoption. |
| `BASE-AGENT-013` | HARD | A1 docs/tool/template equality, A2 computed-class proof links, A3 all listed negative harness mutations, A4 every acceptance under both policies and A5 stranger specialist journey remain incomplete. Current catalogue/docs/checks exist (`scripts/agent-door/surface.mjs`); undeclared features run zero assertions. Reserve sd f315/f319/f322; complete registry and two-policy product work remain. |
| `SURFACE-001` | HARD | A1 exact contract-table tools/classes/Core ids; A2 full Core coverage; A3 actually served templates; A4 canonical/legacy alias equivalence; A5 full two-policy harness remain unqualified as a whole. A4 bounded native aliases already compare via `tests/agent-handoff/clients.mjs`; 55-tool native catalogue is not the complete contractual lifecycle table. Existing adoption hold stays; no builder promotion. |
| `SURFACE-002` | HARD | A1 feedback reply; A2 non-email-TEST destinations/follow-up; A3 public repository writes; A4 tracker exposure; A5 model/context/source-fetch egress; A6 paid amount/payee; A7 non-TEST injection invariance; A8 outside invitations/identity grants remain unqualified. Exact-native-identity email TEST internal/external and changed-address fencing are built. Trusted domain/workspace source and pricing are unresolved prerequisites; do not trust labels. |
| `SURFACE-003` | HARD | A1 filter/source-fetch/tracker security; A2 identity access/conversion; A3 members/credentials/successor; A4 hold/direct-cutoff/replay-reference removal; A5 destination/erasure counts; A6 replay security/live/destructive; A7 ordering/sharing/intake budgets; A8 promotion/merge-resend facts remain. Only A4 existing 30–90-day window slice is qualified (`retention-classes.mjs`); native setting semantics and exact reviewed counts must drive new classes. |
| `SURFACE-004` | HARD | A1 chat/paging account+consent; A2 repository/deploy app versus existing credential; A3 sign-in/context consent; A4 hosted checkout/terms; A5 unconditional person handoff; A6 tracker new-app/existing-app consent distinctions remain unbuilt. Provider lifecycle classification must be tied to real adapter state, never agent flags. |
| `SURFACE-005` | HARD | A1 complete seeded triage/grouping/release/deploy/reply/reproduce/public-fix/merge/verify week; A2 all autonomous no wait/refusal/review; A3 held once-only effects/feed; A4 external-blocked selective refusals and A5 managed Business/all-class setup remain. A5 unpaired unanswered native setup already has UI/MCP proof (`tests/agent-door/setup.mjs`); entire journey depends on unfinished native jobs and SURFACE classifiers. |
| `AI-001` | HARD | A1–3 bounded native packet/untrusted labels, cross-project/mutation/selector injection and next-call revocation exist (`tests/agent-handoff.mjs`, selector-refusals). Automated-work model-egress controls remain requirement work. Cursor/Copilot/Claude use is field R-18, not missing packet implementation or a reason alone to block acceptance. |
| `AI-002` | HARD | A1 automatically minimal failing case plus competing-cause experiment and A3 fixed-release repeated proof across the target runtime scope remain incomplete. A2 malicious/timeout/missing artifact and A4 failed-setup named failures exist (`tests/execution/reproduce.mjs`). Current mapped-JS supplied calls are not minimization or non-JS/mobile reproduction. |
| `AI-003` | HARD | A1 real minimal source patch plus fails-before/passes-after regression and A2 actual draft PR/MR remain incomplete; current `fixes/provider.ts`/`tests/execution-journey.mjs` create a data artifact under a GitHub edge fake. A3 cancellation/expiry/revocation must retain once-only effects across the complete source-edit workflow. GitLab and scoped source/test execution span subsystems; buyer repo proof is R-10. |
| `AI-004` | HARD | A1–4 known-exposure rates/confidence, gaps/inconclusive, restored coverage/recurrence and one follow-up exist (`tests/execution-journey.mjs`, `tests/alerts/repair-recurrence.mjs`). Automatic production measurement and ongoing watch remain requirement gaps; genuine buyer traffic is field R-19, separate from local acceptance. Reserve sd f81 recurrence proof, no duplicate follow-up engine. |
| `AI-006` | HARD | A1 related-site invariant/regression, A2 retained rejected false-positive, A3 person-approved scoped patch with true preparer attribution and A4 recurrence/no self-widening are unbuilt. Depends on real code-repair/test/approval pipeline and authorized repository context. |
| `AI-007` | HARD | A1 authorized tool/model failure capture+cluster+counterexamples; A2 cost/latency/error links; A3 approved offline baseline/candidate evaluation and A4 held promotion/external egress are unbuilt. Needs a new data model, evaluated runtime pipeline and class/consent custody; use local fixtures, no paid model calls needed to start. |

**Batched HELD-EXTERNAL list.** These are the five counted primary holds, one concrete prerequisite each:

- SDK-014: an activated Unity license usable by the named Unity qualification job.
- SDK-022: owner-delegated DNS control for the first-party ingest hostname on an authorized hosted TLS deployment.
- SDK-024: a compatible real Uptime installation's authorized heartbeat endpoint and receiving receipt.
- BILL-002: an owner-authorized billing-partner sandbox with approved USD/tax/terms configuration.
- BASE-AGENT-009: the Business host's cross-seed audit/review/removal journey and authority, outside this read-only repository.

Additional scoped owner/peer asks do not turn locally buildable adapters into held clauses:

- BILL-001/SRC-004/SURFACE-002: ct-approved USD pricing/cap/long-retention commercial terms before monetary claims; no builder-invented prices.
- TEAM-003 A2: ct reconciliation of the exact next-release recurrence wording with the native next-boundary rule; keep existing behavior while unresolved.
- SURFACE-002: ct-approved trusted Business domain/workspace classification source; exact active-native-identity binding remains the current qualified TEST boundary.
- GOV-002: owner-approved US residency/subprocessor/data-flow declaration before hosted residency claims.
- TRACK-001: Vector's supported ticket/callback API contract for actual sibling sync; Jira/Linear official-schema implementation can proceed independently.
- BASE-AGENT-004/005/008/011: shared Base resource-budget/device-credential/own-scope/spend-reservation capability and an actual Business control-plane journey for the corresponding uncovered acceptance.

Field-only account/proof requests remain batched by the register: R-1 physical Apple/Android builds; R-2 genuine authorized Sentry organization bundle/account and dual run; R-3 Datadog buyer; R-5 Bugsnag buyer; R-6 PostHog/GlitchTip/Better Stack buyers; R-7 buyer chat/paging workspaces; R-9 real signed bounce/complaint through the owner-held mail webhook; R-10 source-provider apps and buyer repositories; R-11 tracker tenants; R-12 deployment-provider accounts; R-13 context-provider tenants; R-14 replay tenants; R-15 identity-provider/member logins; R-16/R-17 human screen-reader pass/VPAT; R-18 named agent clients; R-19 buyer production traffic; R-20 authorized hosted owner-account provider qualification. R-4 Rollbar buyer proof is also still not run even though MIG-003 is DONE. None of these authorize this planner to configure accounts, seek secrets or call paid services.

**Ranking and independence.** First make a customer's failure findable, then preserve automatic browser evidence; these are first-week Sentry-switching needs. The Spanish widget and Discord channel are smaller complete interface/channel slices. Web vitals follows because it adds a new retained-data projection. Wider capture scale, native symbolication, genuine migration and full provider/agent registries remain more valuable whole-product gaps but are not safe one-round parallel assignments: their source, storage, pricing or peer dependencies are explicit above.

The five entries share no intended feature implementation files: identity investigation, browser instrumentation, a separate feedback-widget module/package export, Discord delivery, and transaction/web-vitals storage/view. Common source locks, unique additive migration numbering, central route/erasure registration and generated integration metadata may need ordinary landing-time reconciliation; do not serialize the features on one another or borrow a sibling entry's new API. Keep each entry runnable against the audited main. If a new sd round takes a listed slice before dispatch, the feeder drops the duplicate. Gate requirements below are limited to auth, data or migration. UI proof always includes 1440 and 390; screenshots are future builder proof, not artifacts fabricated by this planner.

The complete actual non-secret packet is retained at `/home/agent/rer-consolidation/work/ct-open-points-plan-spool-1/packet/`. Its planner receipt records the audited SHA, read-only checks, source hashes and branch inventory. Publication is report-only to `refs/heads/evidence/ct-open-points-plan-spool-1`; publication does not certify product acceptance, release or landing.

```queue-entries
- Role: BUILDER
  Title: Find a customer's issues without exposing retained identity
  Repository: just-every/run-spool
  IDs: SDK-026
  Acceptance: >-
    Build A1 keep-policy user.email issue search and bounded identity facets with exact counts;
    A2 read-only collaborators receive counts with values hidden; A3 raw email under hash finds
    nothing; A4 dropped fields return the named unsearchable reason. Preserve A5 count-only egress.
    Use supported id/email/username/ip_address fields only; do not promise automatic-IP visitors.
  Files: >-
    src/domain/investigation/query.ts, search.ts and identity-query.ts (new);
    src/domain/identities/read.ts; src/ui/workbench/IssueList.tsx and IdentityFacets.tsx (new).
  Tests: >-
    tests/identity-search-flow.mjs (new), tests/identity-flow.mjs,
    tests/end-user-erasure-preview.mjs, existing investigation and team journeys.
  Proof: >-
    Unmodified browser/Python SDK inputs; independently known keep/hash/drop sets; complete
    cursor-page, facet and export identity/count reconciliation; owner/member/read-only/foreign
    authority and next-call revocation; no raw identity in agent/alert projections; erased values
    disappear. Capture populated/empty/unsearchable/denied/error states at 1440 and 390 with
    keyboard, Axe and no horizontal overflow. Rerun the emitted-Worker parent journeys.
  Must-not-touch: >-
    Owner erasure identity-search matching or private hash lookup semantics; identity defaults;
    ingress trust; FIELD proof; existing sd priority/user-count scopes; packet expansion;
    CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md or product status judgments.
  Gate: required
  Gate-reason: auth and personal-data visibility

- Role: BUILDER
  Title: Opt into automatic browser breadcrumbs with safe category switches
  Repository: just-every/run-spool
  IDs: SDK-003
  Acceptance: >-
    Build the browser portion of A1: independent navigation, click and fetch instrumentation
    switches. Build the browser portion of A2: automatic occurrence timeline, before-send
    filtering, named truncation and secret-free retained/forwarded evidence. This does not
    complete server instrumentation or the full span/log A4 matrix.
  Files: >-
    packages/sdk/src/browser-instrumentation.ts (new), browser.ts and types.ts;
    SDK browser setup guidance only. Keep existing bounded breadcrumb serialization.
  Tests: >-
    tests/browser-breadcrumbs.mjs (new), tests/sdk-package.mjs, existing privacy and SDK journeys.
  Proof: >-
    Pack the actual SDK into a second-origin browser app; exercise each toggle and navigation,
    click and successful/failed fetch, then capture a real error. Prove disabled categories emit
    nothing, bounded order/truncation, before-send removal and init/close/re-init cleanup without
    duplicate listeners or changed fetch behavior. Plant URL/token/form canaries and reconcile
    storage, owner detail, packet and export exclusions. Inspect timeline/setup at 1440 and 390,
    keyboard and Axe. Browser work only; retain current Node/Sentry behavior.
  Must-not-touch: >-
    Session instrumentation reserved to sd c-f14; shared br/zstd decoder rounds;
    replay, DOM/form-value capture, request/response bodies, server SDK instrumentation,
    identity policy, new model/provider calls or contract/generated status documents.
  Gate: required
  Gate-reason: captured and forwarded telemetry data

- Role: BUILDER
  Title: Ship an independent Spanish feedback widget on existing consented intake
  Repository: just-every/run-spool
  IDs: SDK-004
  Acceptance: >-
    Complete A6: Spool's own widget opened in Spanish has Spanish visible labels and accessible
    names. Add English/Spanish locale choice and description/error-reference submission through
    the existing consented feedback door; retain a truthful description-only boundary.
  Files: >-
    packages/sdk/src/feedback-widget.ts (new), packages/sdk/package.json and build.mjs;
    packages/sdk/README.md. Reuse existing feedback payload and public intake unchanged.
  Tests: >-
    tests/feedback-widget-flow.mjs (new), existing tests/feedback-flow.mjs and SDK package tests.
  Proof: >-
    Install the packed SDK in a second-origin app, open Spanish widget, submit against each of
    two real captured errors and reconcile report IDs and exact occurrences. Assert all visible
    strings and accessible names, validation/send/refusal/success wording, consent-before-send,
    keyboard focus containment/Escape/focus return, retry/busy behavior and allowed-origin refusal.
    Record 1440/390 populated, error and success screens and Axe; preserve withdrawal/archive proof.
  Must-not-touch: >-
    Existing sd SDK-004 private review/contact/PNG/reply implementation; selective contact erasure;
    unmodified Sentry widget APIs; screenshot/contact collection; new backend stores/authority;
    browser.ts/types.ts instrumentation; contract or generated judgment documents.
  Gate: required
  Gate-reason: user-submitted feedback and consent

- Role: BUILDER
  Title: Deliver reviewed Discord webhook alerts through durable delivery
  Repository: just-every/run-spool
  IDs: ALERT-002
  Acceptance: >-
    Complete Discord's channel slice of A1 connection/test/filtered new or regression trigger;
    A2 exact issue link; A4 old-credential stop after rotation/revocation; A5 truthful delivery
    history without duplicate effects. Do not claim Slack/Teams/paging A3 actions.
  Files: >-
    src/domain/alerts/discord.server.ts and discord-destinations.server.ts (new);
    existing destination types/routes/dispatch and destination UI; declare any new custody store
    in existing archive/project/owner erasure machinery, or reuse credential custody.
  Tests: >-
    tests/discord-flow.mjs and tests/discord-ui.mjs (new), existing alert runtime/egress/UI journeys.
  Proof: >-
    Official Discord webhook HTTP-schema edge fake with exact sanitized payload and issue URL;
    distinct TEST wording and reviewed-test enable fence; 2xx acceptance, 429 Retry-After,
    permanent failure and lost-response uncertainty without automatic duplicate resend;
    rotation/revocation/foreign-project/erase/queued-callback fences; no secret URL in reads,
    export, logs or archive. Prove attempts, one Needs attention row and inert restore; capture
    connected/tested/failed/uncertain/revoked states at 1440/390 with keyboard and Axe.
    No live Discord account or paid API is required for this bounded adapter proof.
  Must-not-touch: >-
    Slack alternate-follow-up sd f95; personal notification sd f89; Teams/PagerDuty/Oncall,
    chat identity/actions/unfurls; production sends; new provider accounts; contract status documents.
  Gate: required
  Gate-reason: destination credentials and outbound issue data

- Role: BUILDER
  Title: Show measured p75 LCP and CLS for a captured page
  Repository: just-every/run-spool
  IDs: CTX-001
  Acceptance: >-
    Complete A2 only: the page's web vitals view reconciles p75 LCP and CLS with sent measurements.
    Extend the existing bounded Sentry transaction path with validated numeric LCP/CLS samples,
    explicit units, page/window filters, sample counts and unavailable reasons; no full tracing claim.
  Files: >-
    src/domain/sentry/transactions.ts; src/domain/web-vitals/ (new);
    src/ui/workbench/WebVitals.tsx (new) linked from ReportsView.tsx;
    one uniquely named additive migration if needed and native portability/erasure declarations.
  Tests: >-
    tests/web-vitals-flow.mjs (new), tests/alerts-metric.mjs, current archive/upgrade/erasure journeys.
  Proof: >-
    One unmodified pinned Sentry browser SDK program against reference collector and Spool,
    only DSN changed, plus independent known-set percentile fixtures with ties/missing samples,
    mixed units, invalid numbers, duplicate/conflicting envelopes and page/project/window isolation.
    Assert exact samples and p75, current filters before acceptance, no fabricated missing values,
    no new error/issue units, truthful category outcomes, archive/restore/expiry/erasure and clean
    populated upgrade. Capture populated/unavailable/denied/error views at 1440/390, keyboard/Axe.
  Must-not-touch: >-
    Shared br/zstd transport; transaction p95 alert semantics; full traces/spans/profiles/replay;
    performance-issue detectors; SDK-005 adoption/retention rounds; billing/volume limits;
    CONTRACT.md and generated judgments. Add no paid provider or model dependency.
  Gate: required
  Gate-reason: telemetry data and additive storage migration
```
