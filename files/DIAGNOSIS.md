# Exact staging interaction

The candidate and fresh main have byte-identical sentry-cli product code, `field-refusals.mjs`, `denials.mjs` and `debug-flow.mjs`. The relevant runner difference is one extra `await fieldRefusalFlow(context)` between chunkFlow and debugFlow.

fieldRefusalFlow uploads `synthetic-spool-staged-field-refusal` with deploy authority, obtains HTTP 200, and snapshots it while exercising all unsupported-field and authority refusals. The original helper leaves that successfully staged control unconsumed. Its SHA-1 is `04e4fdc12191fafaab43b58d38739177361f8a52`.

populatedDenialFlow uploads two genuine map bundles, assembles the first and deliberately leaves the second staged. It expects exactly one chunk before testing fourteen read-only-token mutations. When the replay runs fieldRefusalFlow first, the earlier control plus this genuine bundle total two. The assertion fails before any of those denied requests execute. Thus no denied request unexpectedly stages bytes: a test fixture's permitted control leaks into the next fixture.

The fix retains both field-refusal invocations and every existing assertion. It records pre-existing staging, proves the control adds exactly one chunk, completes all original refusal/nonmutation assertions, then uses deploy-authorized artifactbundle/assemble on only the control checksum. These intentionally non-ZIP synthetic bytes receive the normal HTTP 200/error `[malformed_bundle]` response, which consumes the referenced chunk. Added assertions prove exact original staging, product rows, deployment actors, artifact inventory and builds survive. The existing denial assertions remain exactly one live chunk before read-only requests and zero after permitted genuine map assembly.

API-002 requires named unsupported-field errors and read-only writes to change nothing. Authorized fixture staging and its authorized cleanup do not change that rule. No clause judgment, assertion threshold, product authorization handler or denial test is changed.
