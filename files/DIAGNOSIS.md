# Runtime regression diagnosis

- Source branch: cloud/sd-spool-design-keys-2, 5379ddf99bbf5c930790b3fae60b47d8af84474e.
- Existing Verify: 44156366231. Failed runtime job: 134299004802. The completed log was read once with `gh run view 44156366231 --repo just-every/run-spool --job 134299004802 --log-failed`. Its public diagnostic had no assertion, database, SQLite or connection error. No rerun was used: the local reproduction found a deterministic owner-flow mismatch.
- Local reproduction: the unchanged replay of keys-2 fails `tests/runtime.mjs`, in the imported `settingsPrerequisiteGuides` helper (`tests/setup-prerequisites.mjs`). Playwright waits 30 seconds for the Slack destinations region's integration-egress link, which is inside the newly collapsed Settings / Alerts & integrations / Details disclosure.
- Repair: click the native Details summary before following the Slack guide, and check that the advanced integration disclosure starts collapsed. Existing visible-link, same-origin, anonymous document access, pinned Base source, guide recipe and recipe-output assertions are retained. No timeout increase, request retry, assertion removal or product authorization relaxation.
- Temporary private diagnostics: the original error stack was logged only in the local reproduction; the original privacy-preserving `tests/runtime.mjs` was restored byte-for-byte before verification. Private logs, browser session data and generated grants are excluded from this public packet.
- The repaired runtime passes, including Cron, Slack and Business prerequisite guides, documentation publication, owner admission, direct API/document gates, second-owner refusal and immediate revocation.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).
