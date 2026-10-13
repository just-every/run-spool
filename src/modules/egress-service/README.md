# Enforcing egress service

An installation-owned Cloudflare Worker that a seed binds as its `TrustedTransport`. It is the
"enforcing egress service" that Penny (`PENNY_EGRESS`), Vector (`INTEGRATION_EGRESS` +
`INTEGRATION_EGRESS_POLICY`) and Spool (`INTEGRATION_EGRESS`) keep outbound integrations off
without. The binding types remain compatible; hybrid transport guarantees need edition-specific acceptance before adoption. Read [DESIGN.md](DESIGN.md) for what the runtime
gives, what this adds and how each guarantee is proved, [ADOPTION.md](ADOPTION.md) for the seed
steps and [OWNER-STEPS.md](OWNER-STEPS.md) for the live qualification procedure.

**Status:** the hybrid implementation selects pinned rustls for non-Cloudflare answers and
Worker fetch for all-Cloudflare answers. Local tests cover both routes and ownership exclusions.
Live hybrid qualification is pending. Penny, Vector and Spool outbound integrations remain off.
Read [DESIGN.md](DESIGN.md) for the fetch route's re-resolution and origin TLS limitations;
this module does not claim universal destination availability.

## Contract

```ts
// The binding stub a seed receives (workers-types `Service<…>`):
send(wire: WireRequest): Promise<WireResponse>   // ../integrations/core/types.ts
fetch(): Response                                 // always 404
export const EGRESS_POLICY = 'public-dns-pinned-tls-v1';  // legacy Vector marker; see DESIGN.md
```

`send` does exactly this, in order. Any failed step fails the call:

1. `wire` must be `{url: string, headers: Record<string,string>, body: string}`.
2. `validateDestination(url)` from Base's integrations module: HTTPS on 443 only. It refuses
   credentials, fragments, `localhost`-style and reserved names, and non-public IP literals.
3. A named entrypoint must have exactly one valid grant in service-owned `EGRESS_GRANTS`.
   Missing, duplicate or malformed grants fail closed. `allowedHosts: null` explicitly grants
   all otherwise-public destinations; `[]` grants none. The checked-in declaration grants none.
   The grant intersects destination lists. The service's own `EGRESS_ALLOWED_HOSTS` (comma or space separated; exact
   hosts or `*.suffix`, where `*.example.com` matches names below `example.com` but not the
   name itself) applies, and so does the caller binding's `props.allowedHosts`. A host must pass
   both. An unset variable allows any public host. A set but empty variable is a configuration
   error.
4. Headers: `host`, `connection`, `transfer-encoding`, `content-length` and
   `proxy-authorization` are refused. Names must be HTTP tokens and values must not contain
   CR, LF or NUL. The body may be at most 1 MiB of UTF-8.
5. The trusted service variables `EGRESS_OWNED_ZONES` (JSON array of every account zone)
   and `EGRESS_WORKERS_SUFFIX` (`<account-subdomain>.workers.dev`) must be present and valid.
   Every owned zone apex/descendant and the workers suffix/descendants refuse on both routes.
   Caller props and request fields cannot supply or override this inventory.
6. One DNS-over-HTTPS lookup (A and AAAA) at `https://cloudflare-dns.com/dns-query`, within
   15 s. Every A/AAAA record from either response must be public and well formed;
   CNAME records are skipped, and empty or mixed public/private sets refuse.
7. If any validated address is outside the dated official Cloudflare CIDRs bundled in
   [cloudflare-ranges.ts](cloudflare-ranges.ts), connect to the first such address with raw TCP
   and rustls TLS, preserving original-name SNI and standard chain/name/expiry checks.
   If all answers are Cloudflare addresses, POST the original URL with Worker fetch and
   `redirect: 'manual'`. Fetch resolves again and supplies **no application address pin**;
   it relies on platform private-address refusal and platform TLS. Cloudflare edge-to-origin
   TLS follows the destination zone's policy; origin certificate verification is not promised.
8. Both routes preserve request bounds, the 64 KiB response cap and a 15 s exchange deadline.
   Raw responses have a 16 KiB wire head cap; fetch bounds the exposed normalized status/headers
   to that size. No 3xx is followed. Completion, error and timeout close the socket or abort
   fetch and cancel its response, including a response returned after the deadline.

## Refusal codes

Errors carry only a fixed code as their message. They never contain a URL, address, header or
response text.

| Code | Meaning |
|---|---|
| `egress_request_invalid` | `wire` is not the declared shape |
| `egress_destination_refused` | `validateDestination` refused the URL |
| `egress_destination_not_allowed` | outside grants/lists or an account-owned destination |
| `egress_header_forbidden` / `egress_header_invalid` | a transport-owned header / a malformed header |
| `egress_request_too_large` | body over 1 MiB or serialized head over 16 KiB |
| `egress_configuration_invalid` | missing/malformed ownership, grants, service lists or binding props |
| `egress_dns_failed` / `egress_dns_timeout` | resolver error, NXDOMAIN or bad answer / over 15 s |
| `egress_dns_not_public` | no answers, or any answer not public |
| `egress_connection_failed` | socket, TLS or fetch failure, including certificate refusal |
| `egress_request_timeout` | request-to-response over 15 s |
| `egress_response_malformed` / `egress_response_incomplete` | bad status line or framing / peer closed early |
| `egress_response_head_too_large` / `egress_response_too_large` | head over 16 KiB / body over 64 KiB |

## What it does not do

It does not retry, follow redirects, cache DNS, pool connections or send any method but POST.
Route selection happens after complete DNS validation; failures never trigger a fallback.
The raw route pins the address; the fetch route lets the platform resolve again. It does not identify the calling
Worker, because the runtime does not say who called. Possession of a binding to a named entrypoint
is the authority. The service owner assigns that entrypoint's grant; caller props can only narrow it.
Cloudflare currently delivers props but omits them from settings/version readback, so deploy-kit
keeps strict props verification and supports the separately verified service-owned grant mechanism. It does not sign,
queue or classify deliveries: that is `DeliveryService` and the protocol in Base's integrations module.

## Files

`policy.ts` (policy string, limits, codes, destination lists), `transport.ts` (`EgressTransport`,
the ports), `cloudflare-ranges.ts` (numeric route classifier), `ownership.ts` (account exclusion),
`fetch-response.ts` (bounded fetch response), `account-ownership.mjs` (probe zone inventory),
`http1.ts` (bounded HTTP/1.1), `doh.ts` (the resolver), `entrypoint.ts`
(`createEgressEntrypoint`), `worker.ts` (the deployable Worker), `build.mjs` (the deploy-kit
product layout under `dist/`), `deploy.json` (the owner declaration, `workersDev: false`),
`testing/` (the dev double for seed tests, never deployed), `owner-probe.mjs` (the guarded live
probe).
`probe-diagnostics.mjs` projects failure evidence onto public identity, readiness,
HTTP metadata and provider binding names/types, excluding bodies and binding values.
`probe-network.mjs` supplies the command and embedded Worker with bounded requests,
body reads and socket cleanup, including responses or opens that arrive after timeout.

## Deploy

From a committed Base (or seed) checkout, once per account and environment, before any seed
that binds it:

```sh
node modules/egress-service/build.mjs
node modules/deploy-kit/owner-cli.mjs deploy --declaration modules/egress-service/deploy.json \
  --environment production --product modules/egress-service
```

The checked-in declaration denies all hosts. Before granting any destination, install a complete
`EGRESS_OWNED_ZONES` JSON array (explicit `[]` for no zones) and the exact
`EGRESS_WORKERS_SUFFIX`; missing/malformed ownership fails closed on both routes. Refresh this
inventory when account ownership changes. The probe derives it automatically with a token that
can read all account zones and refuses inventories over 5,000 UTF-8 bytes before writes.
Ordinary deployments must provide the same authoritative inventory; larger inventories
require a separately designed trusted storage mechanism.
The Worker is named `egress-service-<environment>` and has no workers.dev route. To restrict
destinations for every caller, add `"vars": {"EGRESS_ALLOWED_HOSTS": "hooks.example.com *.example.org"}`
to `deploy.json`.

## Tests

`node --test modules/egress-service/tests/*.test.ts` (part of `verify:modules`). The `service` and
`delivery` tests run real workerd through Miniflare, with a loopback TLS receiver and a test
certificate authority added only to the separately compiled [tls/test.wasm](tls/test.wasm).
Production [tls/egress.wasm](tls/egress.wasm) has no root-injection export, and the packager
rejects test artifacts. Only
DNS answers, socket routing/delay and the destination fetch edge are faked; TLS, entropy, clock and certificate verification are real. `contracts` typechecks the module and the seed compile fixture.

## Service-owned grants

The production exports are `EgressService` and `EgressRestricted`. Set `EGRESS_GRANTS` to a
JSON array such as `[{"entrypoint":"EgressService","allowedHosts":null},{"entrypoint":"EgressRestricted","allowedHosts":["hooks.example.com"]}]`.
Each entrypoint captures its own name in code; `send` cannot choose another grant. Additional
installation-specific entrypoints can use `createEgressEntrypoint(ports, {tls}, name)`.
The service's `EGRESS_ALLOWED_HOSTS` and any caller `props.allowedHosts` apply independently.

Deploy the service first. A consumer declares `entrypoint` and `grant` on its service binding.
`grant` contains the exact `allowedHosts`, `sourceSha`, `fingerprint`, and `provider`
(`versionId`, `deploymentId`, `etag`) from the service's deployment receipt. This is controller
verification metadata, not a Cloudflare binding property. Deploy-kit reads the service grant,
checks the pinned deployment, uploads the ordinary named service binding, and strictly checks
that binding. Caller readback rejects undeclared service bindings and missing or duplicate binding
names; the provider's `production` environment default is accepted. It repeats service checks
during health verification. A service upgrade requires
an explicit consumer grant/identity update. Request payloads cannot change these values.

The owner probe preserves collected P1–P9 observations when a P5 diagnostic fails, reports P5
as failed with a fixed diagnostic code, and still attempts teardown. Failed or refused cleanup
always exits nonzero and retains the ownership state for inspection; uncertain or replaced
Workers are never deleted. DNS completion, failure and timeout abort unfinished resolver work.
Probe health refuses readiness without its token; authenticated readiness verifies the exact
deployment before destination work. Mandatory P6 requires 403 from direct Worker fetch for
both the private literal and localtest.me; generic errors and other statuses never qualify.
Direct probe network diagnostics have a five-second deadline and DNS diagnostic bodies
have a 64 KiB cap. Completed P3 DNS bodies remain evidence; incomplete queries fail P3.
Invocation deadlines cover response reads: five seconds for readiness, seven minutes
for the twelve sequential service sends and diagnostics in `/run`, and 65 seconds for
`/narrow`. Cancellation and socket close never await an unresponsive peer. A timed-out
public-route observation fails P4, and invocation failure still reaches verified teardown.

See [TLS build provenance](tls/README.md) for reproducible builds, dependencies and byte counts.
