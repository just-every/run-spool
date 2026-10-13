# Egress service: risk memo

## OD08-1c hybrid transport — 12 October 2026

The service validates the URL, request headers and body, destination grants, account
ownership and the complete A/AAAA answer set before sending, retaining both address
record families from each query response and skipping CNAMEs. Empty, malformed or
non-public answers refuse the whole set. The routing choice is made once:

| Validated answer set | Transport and guarantee |
|---|---|
| At least one address outside the bundled Cloudflare ranges | Raw TCP to the first such address, with rustls WASM verifying the original hostname, chain and validity against bundled roots. The application pins the peer address and supplies original-name SNI. |
| All addresses in the bundled Cloudflare ranges | Worker fetch of the original HTTPS URL, POST, `redirect: 'manual'`. The platform resolves the name again; the application does **not** pin or inspect the address used by fetch. |

There is no retry, alternate address attempt or fallback after either route fails.
`cloudflare-ranges.ts` bundles all 15 IPv4 and 7 IPv6 CIDRs retrieved on 2026-10-12
from [ips-v4](https://www.cloudflare.com/ips-v4) and
[ips-v6](https://www.cloudflare.com/ips-v6). Membership compares numeric prefixes,
including compressed IPv6, after public-address validation. These lists select a
transport; they do not authorize a destination or prove where a later fetch goes.
They need deliberate refresh when Cloudflare changes its allocations.

### Fetch guarantees and limits

The fetch route relies on Cloudflare's platform refusal of private network
destinations during its own resolution. Mandatory P6 requires direct Worker fetch
to return 403 for both the private literal `https://10.0.0.1/` and the public name
`https://localtest.me/` that resolves privately. Timeouts, other errors and other
HTTP statuses do not qualify refusal; the raw socket observation remains diagnostic.
These two observations establish only those refusals, not an exhaustive platform
policy proof. Fetch does not expose the address it resolves; a 403 from the named
fixture is an observed status, not independent evidence of its selected address.
A DNS change between DoH and fetch remains
possible. There is no application-level DNS pin or guarantee that a second
resolution still selects Cloudflare. On a Cloudflare-served destination, client
HTTPS verifies the Cloudflare edge; the edge-to-origin connection follows the
zone owner's [TLS policy](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/). The service cannot promise origin certificate/name
verification or end-to-end origin TLS for that path. Successful P1 or a public
HTTP status cannot establish the origin's TLS policy. On the raw route, rustls
verifies the actual peer at the pinned address using the original hostname.

Both paths enforce the 1 MiB request body and 16 KiB serialized request head,
forbidden/invalid headers, 64 KiB response bytes and UTF-8 result, and a 15-second
request deadline including response reads. DNS has its own 15-second deadline.
The raw response parser bounds its HTTP status line and headers at 16 KiB; fetch
can bound only the platform-exposed normalized headers and status, measured as an
HTTP/1.1 head. It cannot inspect the original HTTP wire head or framing. Fetch
may decompress responses; the body cap applies to exposed bytes and the encoded
return string. No 3xx is followed. Socket close or fetch abort and response-reader
cancellation run on completion, failure and deadline. A response arriving after
the deadline is canceled without being read; cancellation itself cannot extend
the deadline. Errors expose only the existing fixed egress codes.

### Account ownership and authority

The service deployment must supply `EGRESS_OWNED_ZONES`, a JSON array containing
**all** zone names owned by the selected account (explicit `[]` for none), and
`EGRESS_WORKERS_SUFFIX`, its exact `<account-subdomain>.workers.dev` suffix.
Missing or malformed configuration fails closed on both routes. The zone apex
and every dot-delimited descendant, and the workers.dev suffix and every
descendant, are refused before DNS or send on both routes. This prevents an
account-owned Worker route becoming an alternative internal delivery path.
The inventory must be refreshed with account ownership changes. It cannot
identify ownership of names outside the declared zones or predict future moves.

`owner-probe.mjs` derives the suffix from the validated `ownerTarget` result and
reads every page of `GET /client/v4/zones?account.id=<selected>&page=N&per_page=50`
at the fixed Cloudflare API origin. It validates each row's account ID, unique
zone identity/name, totals and page metadata before deploying. Missing scope,
partial results, pagination drift and malformed inventory abort before writes.
The token must have visibility to all account zones; a provider response alone
cannot prove that the token was granted that complete visibility. Ordinary
service deployments must likewise install an authoritative complete inventory. The
probe refuses an inventory exceeding a conservative 5,000 UTF-8 bytes before
writing either Worker, to fit the [Worker variable limit](https://developers.cloudflare.com/workers/platform/limits/).
Larger inventories require a separately designed trusted storage mechanism; they
are not silently truncated. Paginated reads are not a point-in-time snapshot of
ownership changes; refresh after account changes before using the service.

Ownership is service configuration, never caller props or request data. Named
service grants, service host patterns and optional caller patterns still intersect;
none can override account exclusion. Exact provider version/deployment/etag,
source and fingerprint checks, strict binding/grant readback, and cleanup
ownership checks remain unchanged. The checked-in deployment grants no hosts.

### Qualification status

The local hybrid tests exercise real workerd RPC binding authority, all bundled
range families, mixed-answer routing, account exclusions, request validation and
manual redirects with fakes only at DNS/socket/fetch network edges. Raw-path
positive delivery and wrong-host, untrusted and expired certificate refusals use
the real rustls WASM against real TLS peers. Fetch bounds and stalled/late-body
cleanup run through the transport send door. These checks do not prove production
platform networking or origin TLS policy. The owner must run the committed-source
P1–P9 probe and retain inventories before making a live qualification claim.

**Penny, Vector and Spool outbound integrations remain off.** Their existing
binding shapes and the legacy `public-dns-pinned-tls-v1` marker are unchanged;
that marker is not evidence that this hybrid implementation pins every request.
Adoption requires the edition's guarantees to acknowledge the fetch distinction
and its own integrated proof. No adoption or deployment occurred in this change.

## Historical evidence (OD08-1b and earlier)

Everything below records the implementation and decisions at the stated time.
Statements about a current default, recommended next step or unimplemented path
in this archive are historical, superseded by OD08-1c above. Observations and
failed attempts are preserved without relabeling them as hybrid successes.

## Historical OD08-1b userspace TLS — 12 October 2026 owner-local time

The production transport now uses rustls WASM over a raw `cloudflare:sockets`
connection to the first DNS-validated public literal address. It retains original-name
SNI and standard chain, hostname and validity checks, bundled Mozilla roots,
Worker Web Crypto entropy and the runtime clock. The HTTP contract, complete A/AAAA
validation, single resolution, limits and redirect refusal remain in place. Native
`startTls` and destination-fetch alternatives are absent. The [TLS provenance guide](tls/README.md)
describes dependencies, reproducible builds and bounds. At attempt 3, production WASM was
605,169 bytes; the complete 12-module Worker was 645,795 bytes, including 8,715 bytes of generated glue.

The third authorized run used source `eb34e5fe63e95e6af4f52f76788b0904becaa8fb`
in RunEditRun account `b20c0ca9cab0c2b70e13d7cf724b89bd`. Evidence is under
`evidence/od08/1b-egress/` relative to the consolidation workspace:
`probe-attempt-3.json`, `live-attempt-3.log`, and the before/after inventories.
The first three live attempts each tore down both owned probe Workers.
Attempt 3's mandatory result is **failed (exit 1)** because P1 still requires
`example.com`. **Penny, Vector and Spool outbound integrations remain off.**

| Row | Pass | Observation |
|---|---|---|
| P1 | false | httpbin receiver 200; good-certificate badssl.com 405; example.com `egress_connection_failed` |
| P2 | true | wrong-host, self-signed, untrusted-root and expired badssl endpoints each refused with `egress_connection_failed`, alongside the working positive controls |
| P3 | true | exact random `rer-egress-probe-41a62c6c4cc9.example.com` refused; separately labelled diagnostic A and AAAA queries both returned HTTP 200, DNS Status 0 and no address answers; example.com A and AAAA both had public address answers |
| P4 | true | would-be egress workers.dev route 404 |
| P5 | true | named service grant and deployment/binding identities verified; restricted badssl.com request 405; otherwise-working httpbin receiver denied with `egress_destination_not_allowed` |
| P6 | true, informational | raw private fetch 403; raw private socket refused by provider |
| P7 | true | 302 with `Location: https://169.254.169.254/`, never followed |
| P8 | true | localtest.me and 10.0.0.1.nip.io both `egress_dns_not_public` |
| P9 | true, informational | IPv6-only endpoint returned 405; its failure would not fail mandatory qualification |

Raw diagnostic sockets to example.com's observed A addresses, `104.20.23.154` and
`172.66.147.243`, both failed before TLS with the provider's error:
“proxy request failed, cannot connect to the specified address. It looks like you
might be trying to connect to a HTTP-based service — consider using fetch instead”.
These addresses fall within [Cloudflare's published ranges](https://www.cloudflare.com/ips/),
which the [TCP socket documentation](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
prohibits as destinations. No hostname/IP substitution, retry or fetch fallback was added.
The recommended owner decision is to use reachable badssl.com as P1's positive control,
while explicitly excluding Cloudflare-fronted destinations from supported availability.
That decision has not been assumed: P1 stays false and adoption stays gated.

Attempt 1 proved that Cloudflare accepts the documented `type: service` binding with
named `entrypoint` and `props`, and delivers the narrowing at runtime, but omits `props`
from both settings and immutable-version binding readback. Strict ordinary props
verification remains unchanged. The supported replacement is service-owned
`EGRESS_GRANTS` for named entrypoints. Deploy-kit checks exact grant contents, source,
fingerprint, version, deployment and etag before consumer writes and during health
verification; it strictly checks the actual named binding too. Missing, duplicate,
widened or changed grants/bindings fail closed. Runtime intersects the named grant,
service policy and any additional caller props. Request data cannot select a different
entrypoint or widen its grant. The checked-in service declaration grants no destinations.

Attempt 2 passed service-grant readback but rejected the updated caller's public health
identity (`health-identity-mismatch-last-status-200`), so it made no narrowed call.
The first response's actual/expected identity was not retained by that probe revision;
its exact cause remains undiagnosed. Attempt 3 added diagnostic capture for that failure
and passed the same strict rollout checks without changing the runtime, retrying an
identity mismatch or weakening verification. It does not retroactively turn attempt 2
into a success.

The after inventory at **2026-10-11T16:04:09.638Z** confirms both probes absent.
Workers 14, D1 8, R2 7, Queues 6, KV 0 and Workflows 8 match the before snapshot;
all original Worker modification timestamps match. No concurrent non-probe differences
were observed; no DNS/zone or other-account write was made. These checks compare names
and Worker modification metadata, not arbitrary resource data.

The subsequent security gate found and reproduced four gaps: undeclared service bindings
passed caller readback, an early DNS query failure left its sibling running, cleanup failure
could leave a successful probe exit, and a failed P5 health diagnostic discarded independent
rows. The corrections reject undeclared service bindings and ambiguous names, abort resolver
work on every completion path, fail the command on refused or failed cleanup while preserving
state, and retain P1–P9 with fixed diagnostic failure codes. The focused service-grant test now
also verifies legitimate provider environment defaults and ordinary secret/variable bindings;
the transport regression exercises early failure, deadline and completed lookup cancellation.
Live follow-up evidence is recorded separately under `evidence/od08/1b-egress/fix-report.md`;
the attempt-3 table above remains its historical observation.

The native-TLS source and OD08-1 evidence below are historical, superseded by this section.
They are retained as provenance and do not describe the current implementation.


## OD08-1 edge result and settled default — 11 October 2026

The final live invocation started at **2026-10-11T12:28:47.811055+00:00** on
Node **26.0.0**, from committed source
`138b49a3aea58f0b527d46918700a37b19791f76`, in RunEditRun account
`b20c0ca9cab0c2b70e13d7cf724b89bd`. Evidence is in
`evidence/od08/1-egress/`, relative to the consolidation workspace root:
`probe.json` and `live-run-3.log`. There were **three live invocations total**:
the first two aborted with `binding-readback-mismatch` before printing P1–P9
rows; the second run's diagnostic identified omitted binding props in provider
readback. The third completed all rows and exited **1**. Missing rows from the
first two attempts are not passes. The final receiver was `https://httpbin.org/post`.

**The default is now userspace TLS inside the dedicated egress Worker**: the
fallback specified by base69, a WebAssembly rustls client with a bundled root store over raw
`connect()` pinned to a validated address. P1 failed at both the receiver and
`https://example.com/`, settling the earlier conditional decision. This fallback
has **not been built here**. Penny, Vector and Spool contracts are unchanged and
their outbound integrations remain off; this is no availability or seed-adoption
claim.

| Step | Recorded `pass` | Exact `observed` JSON | Interpretation |
|---|---|---|---|
| P1 | `false` | `{"receiver":{"error":"egress_connection_failed"},"exampleCom":{"error":"egress_connection_failed"}}` | Operational failure of this pinned startTls path at both endpoints. The generic error does not isolate the autogate or missing SNI from endpoint/socket failures. |
| P2 | `true` | `{"wrongHost":{"error":"egress_connection_failed"},"selfSigned":{"error":"egress_connection_failed"},"untrustedRoot":{"error":"egress_connection_failed"},"expired":{"error":"egress_connection_failed"}}` | Rejection predicate passes only. With P1 failing, these refusals do not independently prove certificate-chain or hostname validation. |
| P3 | `false` | `{"nxdomain":{"error":"egress_dns_not_public"},"publicName":{"error":"egress_connection_failed"}}` | False: random `*.example.net` returned `egress_dns_not_public`, not expected `egress_dns_failed`. example.com passed DoH/public-answer validation before connection failure. See the DNS qualification below. |
| P4 | `true` | `{"status":404}` | The would-be workers.dev URL returned 404; egress deployment declares `workersDev: false`. This is not an enumeration of all possible public routes. |
| P5 | `false` | `{"propsVerified":false,"deploymentError":"binding-readback-mismatch","expectedProps":{"allowedHosts":["example.com"]},"readback":{"binding":"EGRESS_NARROW","propsPresent":false},"narrowed":null}` | Provider readback omitted narrow props; strict readback failed. `/narrow` was not called, so effective runtime narrowing remains unproved. |
| P6 | `true` | `{"fetchPrivate":{"outcome":403},"connectPrivate":{"error":"proxy request failed, cannot connect to the specified address. It looks like you might be trying to connect to a HTTP-ba"}}` | Informational refusal of one private address via both APIs; never a substitute for service DNS enforcement. Socket error is the complete recorded string, truncated by the probe to 120 characters. |
| P7 | `false` | `{"redirect":{"error":"egress_connection_failed"}}` | Live redirect behavior is unproved: no HTTP status or Location was returned to the probe. |
| P8 | `true` | `{"localtest":{"error":"egress_dns_not_public"},"nip":{"error":"egress_dns_not_public"}}` | Both named probes were refused with the recorded DNS-policy code; raw DNS answers were not captured. |
| P9 | `false` | `{"ipv6Only":{"error":"egress_connection_failed"}}` | No IPv6 availability proof. This failure cannot isolate IPv6 from the shared P1 TLS/connection failure; A-first policy is unchanged. |

`transport.ts` assigns `egress_dns_not_public` to no answers as well as a
non-public answer (and an invalid answer-array shape). The random-name result
therefore does not establish which condition occurred. Raw DNS responses were
not captured, so do not diagnose an exact DNS cause or relabel P3 as passing.
The source's P1 `wanted` string attributes failure to startTls; the generic
observations alone support only the narrower operational conclusion above.

Final `after-inventory.json` at **2026-10-11T12:30:02.174Z** confirms both
`egress-service-probe` and `egress-probe-probe` absent: no deployment was kept.
`inventory-comparison.json` records unchanged before/after names and counts:
Workers 14, D1 8, R2 7, Queues 6, KV 0 and Workflows 8; all original Worker
modified timestamps are unchanged. These are inventory observations, not a
claim of byte-for-byte data verification. No zone writes were in scope or recorded.

The next implementation brief is the userspace-TLS fallback, followed by scoped
local certificate, DNS-pin, bounds and redirect proof, then a **newly authorized**
edge probe. Resolve provider props readback/runtime narrowing and the negative-DNS
probe expectation separately before seed adoption. The three-invocation allowance
is exhausted; this result does not authorize another run. Remaining merge gates
are base71 green on Base main, one m1 **24/24** run of the eventual merged head,
and review. Recording this result does not merge or deploy the change.

## Historical source and local-runtime memo

The memo and local proof table below describe the existing startTls implementation.
Its conditional edge decision is settled by the dated live result above; local
proof is retained and does not establish production availability.

Sources read for this memo (11 Oct 2026), all pinned by Base's `pnpm-lock.yaml`:
workerd `v1.20260907.1` (commit `beb7bd5c`, GitHub source), `@cloudflare/workers-types`
`5.20260908.1` (`default-seed/node_modules/@cloudflare/workers-types/index.d.ts`), Miniflare
`5.20260907.0-alpha` (`node_modules/miniflare/dist/src/index.js`) and Wrangler `4.129.1`
(`wrangler-dist/cli.js`). Line numbers refer to those files.

## What the runtime already refuses

**`fetch()`.** Redirects are followed by default (`api/http.c++:338`, up to 20, `:1472`); only
`follow` and `manual` parse (`:615-623`), so there is no `redirect: 'error'`. The runtime resolves
the hostname itself. Nothing in the request types lets a Worker check the answers and then pin
the connection to one of them. `RequestInitCfProperties.resolveOverride` (`index.d.ts:13179-13187`)
only reroutes to another hostname proxied on the caller's own Cloudflare zone, so it is not an
address pin. In plain workerd the implicit `internet` service is `restrictPeers({"public"})`
(`server/server.c++:7072-7087`; default `allow = ["public"]`, `workerd.capnp:872`). That service
backs `fetch()` and `connect()` (`server.c++:2496-2498`, `NetworkService::connect` `:2465-2475`).
Miniflare widens it to `["public","private","240.0.0.0/4"]` (`index.js:68785-68795`), so local
development refuses nothing. The production edge does not use workerd's network service. Its
outbound policy is not in this source and is covered by live probe P6.

**`connect()`** (`cloudflare:sockets`, `index.d.ts:15888-15894`) takes a hostname or an IP literal.
The API itself checks only length and characters (`api/sockets.c++:108-134`, `:420`). Address
classes are left to the network service above. `secureTransport: 'starttls'` plus
`Socket.startTls({expectedServerHostname})` (`index.d.ts:3876-3897`) is the one hook that
connects to a chosen address and verifies TLS for another name: the hostname becomes the TLS
peer name (`sockets.c++:581-586`).

**Production risk, the deciding fact.** `startTls` with `expectedServerHostname` sits behind the
autogate `STARTTLS_REJECT_EXPECTED_SERVER_HOSTNAME`. The autogate's own comment says the option
"is not currently supported"; when the gate is on, `startTls` throws a `TypeError`
(`util/autogate.h:80-82`, `sockets.c++:533-541`). Commit `abaf47f02a` (27 May 2026) is titled
"Throw error when expectedServerHostname is passed to startTls in prod". workerd issue #6903
(opened 28 Jul 2026, still open, last comment 9 Oct 2026) reports that on the production edge the
option sends no SNI. Hosts that need SNI then fail the handshake. Local workerd honours the
option and logs `NOSENTRY startTls called with unsupported expectedServerHostname option`, which
the tests here show. The current service **fails closed** on connection/TLS errors and has no automatic
fallback. The live result above records two P1 `egress_connection_failed` observations;
that generic code cannot identify the failing socket/TLS stage. Userspace TLS is
now the selected next implementation path (OWNER-STEPS.md).

**Service bindings and callers.** `ExecutionContext<Props>` exposes `props` and nothing about
the caller (`index.d.ts:496-505`). `WorkerEntrypoint` keeps `ctx` and `env` protected and exposes
prototype methods as RPC (`:15631-15640`). `props` come from the caller's binding configuration:
Wrangler sends `props` in the upload metadata (`cli.js:154940-154957`) and Miniflare's worker
binding carries it (`index.js:52978-52984`). The callee can neither identify the calling Worker
nor tell two callers with equal props apart. **The binding is the capability.** A Worker without
one has no path to the service except a public route, and the egress Worker has none
(`workersDev: false`). `props` are written by the installation owner's deploy declaration, never
by caller code, so the design uses them to narrow destinations. Local proof remains valid, but
P5 above leaves provider readback and effective edge narrowing unproved. The service intersects them with
its own list, so a caller's props can narrow destinations but never widen them. Per-consumer
entrypoints would add exported classes and no extra authority, so the service uses props.

## What the service adds

Destination rules (`validateDestination`, then `EGRESS_ALLOWED_HOSTS` and the caller's
`props.allowedHosts`). One DNS-over-HTTPS resolution with every answer checked by Base's
`isPublicAddress`; one non-public answer refuses the whole set. `connect()` to the first answer
and `startTls` for the original hostname, which is the Worker counterpart of the Node lookup pin.
It writes its own HTTP/1.1 POST and reads a bounded response. It never follows a redirect. Limits
match `NodePinnedTransport`. Every failure is a fixed code. `fetch` answers 404, and `send` is the
only other RPC method.

## Guarantees and their proof

Test names are `node:test` names in `tests/`. P-steps are in OWNER-STEPS.md.

| Guarantee | Local proof (workerd unless noted) | Live-only proof |
|---|---|---|
| Destination is public HTTPS on 443: no credentials, fragment, local or reserved names, no non-public literal | service: *refuses non-public literals, non-HTTPS, credentials, ports and local names before any connection* | — |
| Every DNS answer is public; a mixed set is refused before any socket opens | service: *refuses a name whose answers include any non-public address, alone or mixed, before any connection*; doh: *any unusable resolver answer fails the lookup, and a non-public answer refuses the destination* | P8 (real names that resolve to private addresses) |
| One resolution; the socket opens to the first validated address only | service: *a DNS answer that changes between check and connect…*; *public answers connect only to the first validated address* | — |
| The resolver is the fixed DoH endpoint, A and AAAA, with CNAMEs skipped; it is the Worker's only fetch | doh: *the DoH resolver asks the one fixed endpoint…*; service: *no fallback…* (global fetch recorder empty) | P3 (DoH reachable from the edge) |
| TLS verified for the original hostname: chain to a trusted root and name match | service: *a certificate for another hostname or from an untrusted authority is refused* (real workerd TLS, fixture CA trusted through `NODE_EXTRA_CA_CERTS`); *delivers a signed webhook…* (receiver sees SNI = original host) | P1 (pinned TLS works on the edge at all), P2 (bad certificates refused on the edge) |
| No redirect is followed; a 3xx is the response | service: *a 302 to a refused address is returned as the response; nothing follows it* | P7 |
| Request limits: 1 MiB body, forbidden and invalid headers | service: *limits and malformed responses are refused with fixed codes* | — |
| Response limits: 64 KiB body (length, chunked, close-delimited), 16 KiB head, malformed status, incomplete body | service: *limits and malformed responses…* | — |
| Time limits: 15 s DNS, 15 s connect-to-response | service: *limits…* (shortened limits through the library constructor) | — |
| No fallback to fetch, a second resolution or an unpinned socket | service: *no fallback: a failing socket fails the call and global fetch is never used* | — |
| Only a bound caller reaches `send`; no public door | service: *callers: the binding is the capability, props only narrow, the public door is 404*; deploy-kit: *the egress Worker deploys without a public route…* | P4 (no workers.dev route on the edge) |
| Caller props narrow and never widen; widened props are deploy drift | service: *callers…*; deploy-kit: *a consumer declares the service binding…* | P5 (provider echoes `props` on readback) |
| The deployable artifact is the tested code | service: *callers…* (the Worker `build.mjs` emits answers 404 and refuses before DNS) | P1 |
| Seed contracts unchanged | contracts: *the service typechecks against workers-types and its binding satisfies the Penny, Vector and Spool contracts* | — |
| Seed-shaped delivery with HMAC and replay | delivery: both tests | — |
| Edge refuses private addresses on its own (defence in depth, not relied on) | — (Miniflare allows private) | P6 |
| IPv6 egress for AAAA-only names | — | P9 |
