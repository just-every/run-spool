# Native transport outcome map

All references are to protocolContract in `tests/agent-door/protocol-contract.mjs`, invoked unconditionally at line 22 of `tests/agent-door.mjs` and already included by Verify's core flow. The actual candidate and run provenance is in the receipt files.

| Outcome | Public-door proof | Observed result |
| --- | --- | --- |
| 1 | First MCP request is signed modern discovery, lines 38 to 47; reconciled against legacy initialize at lines 54 to 64. | Supported revisions, capabilities, serverInfo and specialist instructions agree. |
| 2 | Handshake-free modern lists, lines 47 to 51; body-only legacy initialize and legacy lists without modern metadata, lines 54 to 64, alongside the retained metadata-bearing client. | Each complete offered list has 55 unique sorted names with the same complete descriptions. |
| 3 | Unsupported discovery, lines 100 to 104. | HTTP 400, named UnsupportedProtocolVersion, requested revision and supported revisions; populated native records unchanged. |
| 4 | Repeated full modern and legacy results, lines 47 to 65; cache helper at line 36. | Identical complete results, stable ordering, integer nonnegative ttlMs and private cache scope. |
| 5 | Discovery mismatches and foreign Origin, lines 105 to 110, plus valid native mutation refusals at lines 115 to 120. | HTTP 400 HeaderMismatch and HTTP 403 Origin refusal, with unchanged populated state and custody. |
| 6 | Oversized valid native mutation, declared length and streamed body, lines 121 to 128; baseline at lines 72 to 99 and bounded control at lines 129 to 142. | HTTP 413 with all populated native state unchanged; the same bounded mutation completes exactly once, after native sponsor approval under held policy. |

Each outcome runs against a separate real emitted Worker installation for each of the autonomous and held policies. The snapshot includes full retained issues, events, releases, alerts, grouping proposals, native operations and calls, and approvals. A proposal is actually created through MCP and read through the native person route; a completed native mutation populates replay and attribution custody before the snapshots. No direct database write seeds the assertions. Native database reads supplement ordinary record read-back for no-effect checks.

This table qualifies the specified transport slice. It does not claim the clause's omitted resource and prompt implementation, complete registry conformance or hosted qualification. Those remain in the PARTIAL Gap. The installed pinned shared conformance invocation is retained and run separately, with its scoped capabilities reported honestly.
