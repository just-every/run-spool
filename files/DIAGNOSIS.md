# Key selection diagnosis

The c1 journey waits for the deploy-key POST response, dismisses the once-only key callout, then opens `.key-row.last()` and revokes that row. Its later built-in test capture still uses the ingest key returned when Cedar was created.

`src/domain/api.ts` returns `{key, hash, kind}` for a successful key POST. The Settings row already identifies the same credential using `data-key-hash={key.hash}`. The key-list GET has no SQL ORDER BY. More directly, `SettingsView` calls `refresh()` after the POST, while `useProjectData` performs a separate asynchronous key-list read; observing a POST response does not prove the created row has rendered. A positional locator may therefore match the pre-existing ingest row, including while that refresh is in flight. Equal creation timestamps are not needed for this race.

The scoped repair selects the row using the POST response's hash. Playwright then waits for that particular row before opening its details. The existing revoke control and revoked-state assertion are preserved, and the existing journey explicitly confirms the ingest credential remains unrevoked before its later capture. No product sort-order promise is introduced. No sleep, retry, timeout increase, skipped test or weakened assertion is needed.

The baseline execution and observations are reported separately; source inspection establishes a possible race, not the frequency of that race in GitHub CI.

## Observed baseline results

The unmodified full journey on 8ef55561973155476e8c9c8d98c1c7b2e80c8b70 passed 1/1 times: 22 groups and 100 captures at 1440 and 390. No natural failure rate is inferred from this single pass.

A separate report-only public-door probe held only the browser GET key-list refresh, with an explicit promise released after the revocation response. It added no sleep, test retry or timeout change. A valid capture was accepted with HTTP 201 first. The original `.last()` selector then picked the ingest hash rather than the created deploy hash; the ingest credential was revoked, the created deploy credential remained active, and the same valid capture returned HTTP 401, outcome rejected, reason invalid_ingest_key. This confirms the stale-row mechanism without claiming the historical CI run's exact request timing. Receipt: baseline-key-race-receipt.json. The initial probe fixture omitted the required version/stack shape and failed before key actions; its failure log is retained, and the corrected probe keeps the acceptance assertion.
