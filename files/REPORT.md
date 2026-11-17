# sd-spool-import-sentry-4 — linear roster/ownership replay

Recorded 2026-11-17T20:57:48Z. Repository: just-every/run-spool. Branch: cloud/sd-spool-import-sentry-4. Product head: 8d44b36e050201ea0923e4d767ba346f9466328e. No PR was created. No main/default branch was pushed, merged or fast-forwarded. No Base refresh, release metadata edit, self-submission, tag or release was performed.

This is a linear re-apply of an independently gated round.

## Plan and execution

The full working plan is [PLAN.md](PLAN.md). Fleet identity, decrypted-bundle Git helper, push guard and repository-preserving hooks were installed. The only product repository was cloned with depth one and blob filtering, then deepened for the six source commits. The source branch was independently fetched and confirmed at f30b750c3355ed4acaa20f950ef0c6e7c36ef1c4. The assignment reports that head's prior independent gate pass and Verify 44106664998; those are historical inputs, not this candidate's CI result.

Fresh main was 3b7a3ebe545f3bd9c6a979ca04d5687c6a375b09. All six commits were replayed as ordinary commits, followed by one source-lock correction commit; there are seven ordinary commits and zero merge commits above that base. Intermediate saves carried [skip ci] and were pushed with the fleet guard after complete identity/message/trailer inspections. No published history was rewritten. The final commit carries no skip directive.

| Original | Re-applied | Subject |
| --- | --- | --- |
| c61934a7a08e324dfc140ae5bb5312fc5de319b3 | 7a4ac8fd1005303e64cbfb4b115d47bb26af14d5 | Add inert Sentry roster and ownership review on capture-aware main [skip ci] |
| 76369f536e7b3dc58227197dfb43441a74619f40 | add57abe369d1bb40f5bc33a741bf2b9d2327cfd | Verify native roster authorization and portable Sentry proposals [skip ci] |
| 0b0848094c1fb77d12e8d331d69c1c7bc90579b6 | 93c9fcff8b6cfe1b3349e1950e035ba60673d171 | Scope ownership preview to its source roster and document erasure holds [skip ci] |
| 427828960f1389e15f28b0b55a2a8c7ed2b86e80 | 6c8d6c332954ef7fef300af7cfa2608745455ef8 | Record source review and native invitation actions distinctly [skip ci] |
| c0f0cd98a6a536dde0b06dac2139f77f25129c3d | 2bcd3819c9d75d77bcff60445499cca1291dedf4 | Preserve earlier archive inventories with Sentry review custody [skip ci] |
| f30b750c3355ed4acaa20f950ef0c6e7c36ef1c4 | 6eea98d125d2f603e4324afbea7c65da0b786de3 | Document archive compatibility and qualify the linear Sentry roster replay |
| Source-lock correction | 8d44b36e050201ea0923e4d767ba346f9466328e | Preserve main verification images in the regenerated source lock |

The original round's member, erasure, audit, portability and UI wiring was retained as part of the requested complete six-commit replay. New reconciliation work is confined to the import parser/accounting, its tests/docs and regenerated integration spec/source lock. Main's newer contract judgments remain byte-identical.

## Reconciliation

- Mapping is spool-sentry-org-v2. Capture manifest validation, page/hash inventory, keys collection and main's full per-pointer field accounting remain in place.
- Ownership uses its project slug as its source identity and maps the same capture collection into a disabled private review record. Its raw rules, schema and source timestamps remain available for review. Source activation flags never enable live routing.
- Roster scopes include team-member scope identity; member verification/SSO/2FA fields remain unmapped and confer no native trust. Unsupported source roles remain rejected.
- The old schema captures omit required member/ownership timestamps. These two records remain explicitly rejected without fabricated dates; valid team records become inert proposals. Their complete rejection ledgers remain readable. The public field-accounting oracle was reconciled to this behavior.
- Both targets.ts authority fences are preserved: read returns an authorized revision when native project grants or service scopes exist, and the SQL write/undo guard requires their absence. Main's compact native-set comparison and short-ID cleanup are also preserved.
- The broad HTTP suite rewrote 20 tracked legacy TEAM-004 proof images. The post-push tree audit caught that the first final lock referenced those uncommitted image bytes. The generated images were preserved in the report packet, main's original images restored, and the lock regenerated and checked in a separate ordinary correction commit. Published history was not rewritten. Sources.lock.json was regenerated last and checked. Contract write/check passed with no view changes; ACCEPTANCE.md and docs/CLAIMS.md were restored from main and not committed. No Status, Gap or Evidence cell changed, and no clause meaning or RELEASE.json entry changed.

## Actual local results

The completed passing local steps are: contract-write, contract-check, source-lock, install, first-party, source-check, base-offline, build-app, integration-check, typecheck, rer-build, roster-ownership, old-archive, sentry-http-retry, sentry-import, source-lock-final, source-check-final, integration-check-final, contract-check-final. Setup also completed with the required fleet owner argument through cloud_run; its private owner-entry log is excluded. The ordered build and standalone roster/archive checks used Node v24.19.0 and pnpm 10.12.4 under the supplied setup. The first Sentry HTTP attempt stopped at tests/worker.mjs:73 during a nested worker's migration batch: Miniflare's internal RPC assertion `message?.id === id` failed, with no SQL/D1 or product assertion diagnostic. That failure and its worker output are preserved. A single bounded HTTP retry and the import journey use the repository's exact Node 22.20.0 pin, matching Verify. Their results are listed above; no product or test assertion was relaxed for the retry.

The standalone rosterOwnershipFlow passed with 17 source records, 11 effects, one named unsupported-role rejection, two imported projects and nine pending review records (six member, two team and one ownership). Native member count remained 1 → 1 during import. Project count was 0 → 2; review records were 0 → 9. The journey proves no-write review, no import mail/session/grant effects, role/scopes, exact retry, disabled ownership overlap/unmatched preview, guarded undo, a separately authorized native invitation/removal, safe audit portability, inert archive restore, owner-erasure custody hold and project erasure. Browser assertions run at 1440; member, roster and ownership screens were captured at 1440 and 390 and visually inspected. The receipt's head is null because local checks preceded the final commit; local source hashes/tree consistency and exact-SHA CI provide separate candidate provenance.

The old-archive journey passed released-populated upgrade preservation (176 tables, 118 rows), populated 0068 upgrade (201 tables), pre-metric archives, prior roster inventories, fresh restore, occupied target refusal, incompatible-schema and corrupted-closing refusal, and current archive round-trip including transaction bucket ordering. Its complete output is retained.

The isolated D1 populated-0110 proof applied 0110 over 0109: 279 pre-existing tables and 46 rows stayed exact, including four provenance rows, one native project grant and one native service scope. Upgrade invented zero review records and left zero foreign-key violations; a new inert proposal/provenance kind was accepted afterward. Both executable proof and actual receipt are retained. A separate emitted-adapter D1 proof independently tests member grants and service scopes: each changes read revision to authorized, refuses the old SQL snapshot, and preserves both project and authority under guarded deletion. An unchanged-state positive control passes. Its executable and receipt are retained as authority-fence.mjs/json.

Import/SDK shard accounting receipt:

```json
{
  "synthetic": true,
  "test": "fieldAccounting",
  "profiles": [
    {
      "profile": "baseline",
      "sourceRecords": 26,
      "unique": 25,
      "duplicates": 1,
      "fields": 582,
      "arrays": 89,
      "sourceBytes": 16026,
      "bundleBytes": 26934,
      "sourcePayloadBytes": 15907,
      "nativeBytes": 19347,
      "byKind": {
        "project": 1,
        "release": 1,
        "issue": 8,
        "event": 8,
        "import-proposal": 1
      },
      "interrupted": true,
      "reconciled": true
    },
    {
      "profile": "scaled",
      "sourceRecords": 530,
      "unique": 529,
      "duplicates": 1,
      "fields": 15450,
      "arrays": 2357,
      "sourceBytes": 417238,
      "bundleBytes": 509843,
      "sourcePayloadBytes": 416865,
      "nativeBytes": 599159,
      "byKind": {
        "project": 1,
        "release": 1,
        "issue": 260,
        "event": 260,
        "import-proposal": 1
      },
      "interrupted": true,
      "reconciled": true
    }
  ]
}
```

Proofs are synthetic/local only. No real buyer Sentry import, provider consent, delivered production email, production dual run, cutover or completed live ownership-routing acceptance is claimed.

## Contract counts and judgments

Before and after: 23 done, 54 partial, 28 missing, 105 total. MIG-001 remains partial; TEAM-001 remains done; AUDIT-001 remains partial; ERASE-001 remains done. All other judgments are unchanged. The requested original-round claim-line output is conditional on its original brief producing those lines; that original brief/report was not shipped, so no unverified claim lines are asserted here.

## Product and evidence custody

Verify run 44170066809: completed / success; head 8d44b36e050201ea0923e4d767ba346f9466328e; https://github.com/just-every/run-spool/actions/runs/44170066809. GitHub REST calls used by the single watcher: 6.

Product custody is separate from evidence publication. The complete explicitly selected non-secret packet is published only to evidence/sd-spool-import-sentry-4 using cloud_evidence.py. Evidence publication does not signal READY, acceptance or landing. The fleet's publication scan and landing remain external gates. No local blocker was observed. Product readiness is reported only from this exact head's Verify result.
