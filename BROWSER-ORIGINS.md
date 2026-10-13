# Spool browser capture origins — additive contract, 2 October 2026

Status: implemented local origin policy, migration, archive custody, capture transport and owner controls. Ten non-browser runtime gate groups pass. Actual two-origin browser capture and the new controls' browser/accessibility gates remain pending the external browser launch hold; separately hosted browser compatibility is not yet accepted.

[TARGET.md](TARGET.md) requires browser capture for an independently operated
installation; [CONTRACT.md](CONTRACT.md) requires scoped ingest authority,
sanitized atomic persistence, private owner/agent boundaries and portable archive
recovery. The existing `CaptureOptions.endpoint` already names a separate
service, but a separately hosted browser application cannot complete the helper's
JSON/Bearer fetch without CORS support. The prior implementation lacked ingest OPTIONS and CORS headers. The additive implementation now grants only exact configured project origins on the ingest surface, with scoped keys and atomic membership checks. Server/Worker keyed HTTP capture already works.

The standards basis is small: CORS governs cross-origin response sharing;
preflight checks method/header policy without the subsequent request's bearer
credential, and Authorization must be explicitly allowed. Origins serialize
scheme, host and port; an opaque origin serializes as `null`. These facts inform
the product choices below, which are deliberately narrower than general CORS.
See the primary [Fetch CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol),
[Fetch authorization header rule](https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name)
and [HTML origin serialization](https://html.spec.whatwg.org/multipage/browsers.html#concept-origin-serialization).

## Admission policy

Add owner-configured exact browser origins **per project, for ingest only**.
New and migrated projects have an empty foreign-origin set. Preserve the existing
same-origin capture and server/Worker paths:

| Request Origin | Ingest policy |
| --- | --- |
| Header absent | Retain existing server/Worker transport; active project ingest key and every existing envelope/release/budget gate remain required. |
| Canonical origin equal to this request URL's service origin | Retain same-origin browser transport; active project ingest key still required. This implicit service origin does not consume an allowlist slot. |
| Canonical foreign HTTP(S) origin in this project's allowlist | Permit the bounded CORS transport; active project ingest key still required on POST. |
| Unconfigured, removed, other-project-only, malformed, multiple or `null` Origin | Refuse before reading the event body or mutating telemetry. Return generic 403 `origin_not_allowed` without CORS approval headers. |

Use the actual service request URL, not an untrusted forwarded-host/header
override, to derive the implicit same-origin value. Compare serialized origin
strings exactly after strict validation. An origin configured for project A
never approves project B, even if the caller possesses B's valid ingest key.
Missing Origin is distinct from the literal string `null`.

An allowlist is a browser transport restriction, not proof of caller identity.
A server can omit or forge Origin and a browser-visible ingest key can be copied.
The ingest key remains limited sending authority, never private evidence/read,
artifact, configuration, owner or execution authority. Domain ownership checks,
anti-abuse attestation and secret browser credentials are not claimed.

## Owner configuration and atomic bounds

Add owner-only GET/POST/DELETE
`/api/projects/:project/browser-origins`. POST and DELETE accept exactly
`{"origin":"https://app.example"}` through the existing bounded JSON reader.
Return the canonical origin and created/removed state; GET lists only this
project's configuration. Existing current-session authorization and same-origin
cookie-write checks apply. Agent and ingest keys cannot list or edit it. Do not
add CORS to these routes, login, archive/restore, maps or any private API.

Require a string of at most 1,024 characters whose value equals the URL parser's
HTTP(S) `origin` serialization. Reject leading/trailing whitespace, credentials,
path (including a trailing slash), query, fragment, wildcard, subdomain pattern,
regex, origin list, opaque scheme and `null`. Reject noncanonical spellings with
an actionable canonical-origin hint; do not silently truncate a full URL into an
origin. Examples: `https://app.example` and `http://127.0.0.1:15476` are distinct
valid origins; `https://app.example:443`, `https://app.example/`, `*.example`,
`https://user@app.example` and `https://app.example/path` are invalid inputs.
Unicode host input must be converted by the owner to its displayed canonical
ASCII form before acceptance. Scheme, host and nondefault port each matter.

Append `0003_browser_origins.sql`; never rewrite applied 0001/0002 migrations.
Use a table such as `browser_origins(project,origin,created)` with composite
primary key, project foreign key and bounded origin column. Allow at most **20
foreign origins per project**, enforced inside the database transaction (a
BEFORE INSERT capacity trigger, as with the existing artifact cap), not only by
a prior count query. Inserting an already-present origin is an idempotent no-op,
including at capacity; a genuine new 21st origin returns 429
`browser_origin_budget`. Removing an absent origin is a no-op. Add/remove and
their corresponding `browser_origin_added`/`browser_origin_removed` audit entry
commit together; no duplicate/no-op audit rows. Validate project existence and
origin before mutation. A full list replacement endpoint is unnecessary.

Owner UI guidance should explain the exact application origin and bounded scope,
show the saved origins, and preserve explicit add/remove results. It must not
infer a deployment origin from stack frames, release names or telemetry URLs.
Normal application CSP must allow its chosen service in `connect-src`; enabling
CORS cannot override CSP, mixed-content rules or network failures. Serving the
helper as a normal bundled/imported dependency remains sufficient; this proposal
does not add a second cross-origin module-distribution protocol.

## Strict ingest preflight and response handling

Handle OPTIONS only at the exact `/api/ingest/:project` route, before private
owner/agent middleware. Require a known project, one approved canonical Origin,
`Access-Control-Request-Method: POST`, and a case-insensitive token set containing
exactly `authorization` and `content-type`. Reject missing/empty/duplicate tokens,
other methods, wildcard tokens, extra requested headers and malformed values.
Header names may vary in case/order and surrounding HTTP whitespace; normalize
those token mechanics, not Origin identity. Bound the requested-header field
(for example 256 characters) before parsing it.

An approved preflight returns 204 with no body and only these CORS grants:

```http
Access-Control-Allow-Origin: <the validated exact request Origin>
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 60
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
Cache-Control: no-store
```

Preflight has no bearer-key requirement, sets no cookie, and writes no event,
counter, alert, audit or other state. It approves only transport policy. A failed
preflight has no Access-Control approval headers and performs no mutation.
The configured-origin/existing-project inference from a successful preflight is
an accepted transport-policy side effect; it reveals no private evidence or keys.

On each actual POST, revalidate Origin and project membership independently of
preflight, then execute the existing active ingest-key and admission gates.
For an approved Origin, add its exact `Access-Control-Allow-Origin` and append
`Origin` to Vary on **every** ingest outcome, including invalid key/envelope,
duplicate/conflict, release mismatch, budget and storage failure. Preserve the
current JSON status/outcome semantics. Refused origins receive no CORS grant.
Do not expose private diagnostic endpoints or broaden accepted envelope fields.

Never emit `Access-Control-Allow-Credentials`, wildcard allow-origin/headers/
methods, reflected unchecked values or redirects from this transport. No custom
response headers need exposure: the existing outcome is JSON. Preserve global
no-store/nosniff headers. CORS decoration must be specific to ingest and survive
its error paths; a global permissive middleware is not an implementation.

In [`capture.ts`](src/domain/capture.ts), retain explicit JSON/Bearer headers,
existing normalization, callbacks, event ID and keepalive behavior, and set
`credentials: 'omit'`, `mode: 'cors'` and `redirect: 'manual'`. Omit applies to
ambient browser credentials; the intentionally supplied project Bearer header
remains the sender credential. Never use `no-cors`, opaque-success assumptions,
query-string keys, cookies, beacon-only success or a client-supplied Origin
override. Ingest ignores any ambient cookie; a cookie alone cannot authenticate
it. Owner UI API calls retain their existing session behavior.

A denied preflight/POST may be unreadable to browser JavaScript. Preserve
outcome `unknown` with reason `transport_failure`, not an invented precise
origin-denied outcome or an accepted claim. A raw HTTP check can inspect the generic 403. Server observations
are not a complete capture denominator; this feature adds no unload guarantee,
offline queue, automatic retry, delivery/repair proof or provider egress.

## Removal, concurrency and transaction boundary

The required minimum is that every POST checks current policy, including after
a browser has cached an approved preflight. Removal must block subsequent POST
authorization. A check done only at OPTIONS is insufficient.

For the stronger recommended guarantee, linearize a foreign-origin admission
against origin removal in the same D1 batch as its event/aggregate/alert/counter
commit. A supported database guard must abort the entire batch if membership
has disappeared; a conditional event INSERT alone is unsafe because preceding
aggregate/alert changes could still commit. One concrete additive mechanism is
a short-lived guard table with a composite foreign key to
`browser_origins(project,origin)`: insert a unique guard tuple first, run the
existing admission statements, and delete the tuple before the same transaction
commits. Guard tuples are never present after a successful transaction, never
exported and never stored as event/header evidence; rollback leaves none. Verify
D1 enforces the foreign key and rolls back the whole batch on guard failure.
Return the origin refusal rather than misclassifying it as a storage failure.

This defines concurrent ordering: a committed admission before removal remains
accepted; admission whose guard follows completed removal is refused. Removal
does not delete earlier evidence. Do not promise cancellation of responses
already in flight or reverse an accepted event. A simpler check-before-batch
would permit already-authorized work to finish after removal; choosing that
weaker guarantee must be explicit rather than described as atomic revocation.
Existing key/retry/release/mapping/retention guarantees remain unchanged.

## Archive versioning and prior-data transition

Preserve [`archive.ts`](src/domain/archive.ts)'s version-1 validation path and
legacy identity `migration: '0001_errors'` exactly for previously emitted
archives, even though the installed database subsequently has 0002/0003.
Verify old checksums over their original version/migration/data before any
conversion. Restore valid v1 into a migrated empty database with an **empty
browser-origin table**; do not infer origins or regenerate sessions/grants.
Existing old audit kinds and original diagnostics retain their strict gates.

New exports use archive `version: 2`, `migration: '0003_browser_origins'`, the
original authoritative tables plus `browser_origins`, and one checksum over
the complete canonical version/migration/data object. Export all tables in one
consistent batch. Validate v2 origins as exact rows with only project/origin/
created, canonical origin grammar, safe nonnegative timestamp, existing project,
unique composite identity and the 20/project cap. Keep existing 16 MiB restore
request, 10,000 restored rows/table and all old privacy/map/reference/aggregate
validation limits. Exports have no archive size cap and can exceed restore limits.
Reject unknown versions/identity/table/row fields and guard/credential tables.

Add the two new audit kinds only to v2's strict audit validator, each with exactly
the canonical `origin` detail. Validate those fields as origin configuration,
not as arbitrary telemetry text. Arrays, credentials, malformed JSON, unrelated
fields and inconsistent project references fail before mutation. Original audit
kinds remain valid in v2. Historical removal audits need not have a matching
current allowlist row; restored history must not resurrect a removed origin.

Fully validate either version before empty-target mutation, then restore the
authoritative rows in a single batch with project parents before origins. Invalid
or over-cap configuration leaves the target empty. Include configuration in
equivalence comparisons and re-export restored v1 as v2 with empty origins.
Credentials remain excluded, so restored allowlisting cannot itself capture
anything until the owner creates fresh scoped ingest keys. Never export guard
tuples, sessions, passwords, grants or confidential map bytes in agent packets.

## Required local evidence before support is claimed

Use emitted Worker/local D1 and installed Chrome with two actual loopback
origins inside 15440–15479: Spool service (for example 15440), separately served
test application (15476). Add a third denied test origin when needed. The
browser must load the real bundled helper, subscribe through
`installBrowserCapture`, throw an actual JavaScript exception in that separate
application, and send the real OPTIONS/POST. Network interception or a fake
accepted response is not this gate. Existing authorized synthetic credentials
and test state are a later implementation-test concern; this document accesses
neither and authorizes no production/provider action.

| Gate | Required observable result |
| --- | --- |
| Allowed separate-origin exception | Owner configures only project A's exact application origin. Chrome observes successful preflight and readable accepted JSON; emitted D1 contains the sanitized occurrence, actual application-origin frame, release/build and one correct group/alert. Server persists no Origin header as telemetry. |
| Retry/privacy/outcomes | Exact original event ID/payload duplicates without increment; altered retry conflicts. Allowed-origin invalid/revoked/wrong-project/agent key is readable rejection, and invalid release/body/budget outcomes preserve current status semantics. Scrubbing and packet/source confidentiality still pass. |
| Denied/removed/other-project origins | No allowlist initially means no admitted event. Adding it to A never permits B. Different scheme/port/host/subdomain, `null`, malformed/multiple Origin and removed entries receive no CORS grant and no admitted event. After an initial allowed Chrome capture, remove the origin and repeat in the same context before preflight cache expiry; the actual POST gate, including a direct HTTP POST bypassing preflight, refuses admission. |
| Concurrent origin edits/admission | Race more than 20 distinct adds: exactly 20 origins/audits, deterministic cap outcomes, no partial writes; duplicate at cap succeeds as a no-op. Force removal between early POST lookup and transaction guard: no event, changed aggregate, alert, accepted counter or leftover guard tuple. Preserve previously committed accepted evidence. |
| Cookie/private/agent boundary | Allowlisted browser with session cookie but no ingest key cannot ingest. Helper request sends no Cookie; credentialed cross-origin fetch is not enabled. Allowlisted origin cannot read projects/issues/packets/archives/maps or edit origins through private API CORS. Agent cannot configure origins, ingest, mutate or cross project boundaries; its existing server-side read scope remains unchanged. |
| Strict OPTIONS | Test wrong/missing method/headers, extra/wildcard/duplicate header tokens, malformed/denied/unknown-project Origin, and OPTIONS on private routes. No successful grant or writes. Approved OPTIONS has exact grants, no credentials header/cookie and no event/counter mutation. |
| Same-origin/server/Worker preservation | Existing Chrome same-origin exception still admits with no configured foreign origin. Actual Node/server HTTP without Origin and emitted Worker awaited/`waitUntil` transport still admit with valid scoped key; `Origin: null` is refused. No fake no-Origin browser compatibility claim. |
| Migration/v1/v2 custody | Migrate a database already containing 0001/0002 events/maps/audits; compare preserved bytes/diagnostics/caps. Restore a retained original v1 archive into separately migrated empty D1 and re-export v2 with no origins. V2 origin/add/remove history round-trips without credentials. Rehashed malformed/duplicate/orphan/over-cap origins and poisoned audit/unknown version fail before any target row. |

Record exact source/migration revisions, both origins and real Chrome/network/D1
results, with secrets omitted from logs/screenshots. Passing local two-origin
capture supports only that tested transport and declared origins. Hosted browser
compatibility, measured capacity/cost and production/provider acceptance remain
separate. This proposal is additive to the accepted browser-capture contract;
it grants no new read, owner, model or execution authority.

Implementation adaptation: capture refuses3xx and opaque status0 responses in manual mode, preserving a no-follow boundary across browsers and Workers. The [Cloudflare Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/) recommends manual redirect handling when forwarding sensitive headers must be controlled. The first emitted Worker gate exposed the incompatible error redirect mode; this is an observed runtime adaptation, not weakened delivery acceptance.

Scope correction: ingest-grant expiry is not implemented in the first release; it remains the later scoped-grant obligation in TARGET.md. Origin configuration neither adds expiry nor claims it. Existing revocation and project/kind checks remain required. A restored explicit entry matching the new service origin may be removed without disabling implicit service-origin transport; portable configuration is preserved until that owner action.
