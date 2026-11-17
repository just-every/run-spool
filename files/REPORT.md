# sd-spool-design-issues-3

## Plan

1. Apply fleet identity, credential helper, hooks and launcher instructions. Clone only just-every/run-spool, using a depth-one blobless clone, then deepen its history as required.
2. Confirm original round head a510bbb5505f8468c833bb42cd43350396438f83 and identify its commits. Replay its product changes linearly on fresh main, preserving main's newer contract judgments, privacy changes and unrelated prose. Do not commit ACCEPTANCE.md or docs/CLAIMS.md.
3. Run tests/sentry-cli-compat.mjs repeatedly with hard timeouts on fresh main and on the replayed candidate. Keep separate actual logs and record counts. Diagnose socket failures with retained server output; repair a product defect if candidate-specific, or bound retries of the single public request if comparison establishes an existing flake. Investigate project-erasure race if encountered.
4. Run Issues journeys, generators and source lock last. Run every configured build step in order, including release validation. Stop if clause meaning changes require RELEASE.json metadata outside this lease.
5. Capture the changed screens at 1440 and 390, with assertions at one width. Preserve actual non-secret proof and command receipts outside the product tree.
6. Audit all candidate identities/messages and linear history. Publish the first real commit through cloud-push.py, then substantial changes; do not rewrite published history or push main. Require exact-SHA Verify via bounded REST budget and report any failed jobs honestly.
7. Publish explicitly selected reports and receipts through evidence/sd-spool-design-issues-3, separately from product custody. Return required POST and terminal lines.

## Scope

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).
Design decisions retained: D5, D6, D7, D9, D15, D16 and D22. No release metadata, shared installer changes, Base refresh or other repository writes are authorized.

## Results

Checkpoint, not a READY declaration:

- Confirmed original head a510bbb5505f8468c833bb42cd43350396438f83. Reapplied the net five-commit round on main f44efc8c76f8f11753b89465cc3fcb7b64760570, retaining newer privacy work. Saved and pushed 388c978d44e4e13cc952553618b93cef0efe7456 with [skip ci]. History is linear; author and committer are Run Edit Run fleet <fleet@runeditrun.com>; no trailers.
- Contract generation/check, integration and agent generation, regenerated source lock/check, typechecking, public production build and native release-source inspection passed. CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and release metadata are unchanged. Core remains 23 done / 45 partial / 19 missing of 87; Agent surface remains 0 / 9 / 9 of 18; Full target remains 23 / 54 / 28 of 105.
- Baseline Sentry comparison completed three repetitions: two full passes, one UND_ERR_SOCKET failure in fieldRefusalFlow's owner inventory read after an archive/refusal sequence. Retained Worker output contains successful HTTP responses and no Worker exception. Baseline repetition 3 used the unchanged recorded emitted build while source replay was prepared; its build hash was verified before rebuilding.
- A separate baseline project-erasure probe failed at public dev-server readiness before reaching any erase assertion. This is not evidence of the reported 409-versus-202 race.
- The first raw candidate Sentry repetition failed with ECONNRESET in boundaryState after the two API-002 probes. Its last logged request completed with HTTP 200 after 14.243 seconds, and no Worker exception was logged. Two raw repetitions remain in progress. The Issues browser journey passed 22 check groups and wrote 110 captures at 1440 and 390. No final Verify result is claimed yet. The bounded owner-GET recovery prototype passed real dropped-socket fault tests: closed and reset GETs recover, POST is not replayed, 403 is not retried, persistent socket errors stop after two retries, and readiness stops after five probes.
- All current checks and comparison records are in checks.jsonl, comparison-receipts.jsonl and provenance.json. Setup's actual ready marker and 103 applied migrations were confirmed without retaining its private output.
