# gr-mt-spool-ci-8 plan
Author: Run Edit Run fleet, 2026-11-15 UTC.

1. Set the mandated fleet identity before repository work, refresh the launcher, install decrypted-bundle Git authentication and push guard, and read launcher rules.
2. Clone only just-every/run-spool with full history and a blob filter into work/maint/gr-mt-spool-ci-8/repo. Set clone-local identity, install fleet commit hooks and the repository-pinned toolchain. Work exclusively on cloud/gr-mt-spool-ci-8 from origin/main.
3. Read AGENTS.md, CLAUDE.md, CONTRACT.md, ACCEPTANCE.md and workflows. Use the inline RULES.md. Do not read or write INBOX.md or STATE.md.
4. Inspect the four supplied workflow failure families separately. Read failed-job metadata and each primary failed job's completed log once. Preserve actual API responses and command results. Respect the ten-call GitHub budget.
5. Compare failures with current main and existing fixes. Reproduce the relevant SDK and public command journeys locally, plus the application build and typecheck, using Node 22.20.0, pnpm 10.12.4, system Chromium and the subreaper. Do not run the full suite or weaken assertions.
6. Make only a demonstrated necessary correction. If a product correction is warranted, commit with fleet identity and active hooks, check every candidate author/committer/trailer, satisfy publication requirements, and use the product push guard for the named branch. Never push main or force-push.
7. Write an honest result.json and complete non-secret report/receipts. Publish explicitly selected reports only through cloud_evidence.py to evidence/gr-mt-spool-ci-8. Return the exact evidence custody line and lane POST with SHA, CI run IDs, unchanged counts/statuses and remaining blockers. Do not claim READY without its required verification.
