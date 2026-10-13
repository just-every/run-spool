# Owner steps: hybrid egress qualification

The OD08-1c transport uses raw pinned rustls for the first non-Cloudflare address
in a completely validated DNS set; all-Cloudflare answers use original-URL Worker
fetch with manual redirects. See [DESIGN.md](DESIGN.md) for the distinct TLS and
DNS guarantees. Penny, Vector and Spool remain off pending live qualification and
edition-specific acceptance of the fetch path's limitations.

For an authorized probe, use `owner-probe.mjs` with the explicit account ID,
matching `--confirm-throwaway`, and account-pinned credential helper. The account
may contain unrelated resources. Both probe names must be absent. The token needs
Workers Scripts edit plus read visibility to **all** account zones. The probe
reads all pages of the selected account's zones and obtains the workers.dev suffix
from `ownerTarget` before deployment. A zone/account/pagination mismatch aborts.
These reads do not change zones. The temporary service receives the trusted
`EGRESS_OWNED_ZONES` JSON array and `EGRESS_WORKERS_SUFFIX` configuration; callers
cannot supply or widen them. Ordinary deployments require the same complete,
maintained inventory. Account-owned receivers are intentionally refused.

The procedure retains strict provider identity and service-grant checks, uses
`EgressRestricted` with `badssl.com` for P5, preserves independent P1–P9 rows when
a diagnostic fails, and deletes only confirmed owned Workers whose live provider
identity matches the saved state. Failed/refused cleanup exits nonzero and retains
state for inspection. Obtain complete before/after account inventories separately;
printed rows alone do not prove teardown.

Public probe health reports `ok: false` if `PROBE_TOKEN` is absent or empty.
After each verified deployment, an authenticated `/ready` request checks the exact
source, fingerprint and version before any destination probe. Failed readiness or
invocation aborts without retry. Diagnostics retain only HTTP status, content type,
`cf-ray`, public health identity/readiness and provider binding names/types; token
values, raw response bodies and binding values are never printed.

Each direct network diagnostic, public-route request and health/readiness request has
a five-second deadline. DNS diagnostic bodies are capped at 64 KiB, retaining complete
P3 bodies only. `/run` allows seven minutes for twelve sequential sends (each with
15-second DNS and exchange bounds) and diagnostics; `/narrow` allows 65 seconds.
Invocation deadlines include the full response read. Timeouts abort and cancel network
work and reach ownership-verified teardown even when a peer ignores abort or its
cancellation never settles. A late response is canceled and a late socket open is closed.
Incomplete observations fail qualification; timeouts cannot establish P4 or P6 refusal.

| Row | Current required observation |
|---|---|
| P1 | Receiver and example.com return HTTP through the hybrid service. The good-certificate raw endpoint supplies P2's positive control. |
| P2 | Wrong-host, self-signed, untrusted-root and expired badssl peers refuse with `egress_connection_failed`, alongside successful raw positive controls. |
| P3 | Random `*.example.com` refuses according to separately recorded diagnostic A/AAAA responses, and example.com passes DNS validation. Diagnostic second lookups are labelled and do not describe the transport's one DoH lookup. |
| P4 | Disabled workers.dev route refuses or returns 4xx/5xx. |
| P5 | Exact named grant/deployment/binding readback succeeds, badssl.com works, and the otherwise-working receiver is refused by the restricted grant. |
| P6 | Direct Worker fetch returns 403 for both `https://10.0.0.1/` and `https://localtest.me/`, recording refusal statuses for the private literal and named fixture. This is mandatory because fetch re-resolution relies on platform refusal. The address selected by fetch is not exposed. Timeouts, unrelated errors and other statuses fail qualification. Raw private socket refusal is diagnostic only. |
| P7 | Redirect returns 302 and its private Location without following. |
| P8 | localtest.me and 10.0.0.1.nip.io refuse with `egress_dns_not_public`. |
| P9 | AAAA-only endpoint returns HTTP; informational. |

Exit 0 requires every mandatory row; exit 1 records a completed failed table;
exit 2 reports an abort or failed cleanup. Missing/malformed observations never
pass. Record source commit, runtime, all attempts, JSON and teardown evidence.
Do not infer application address pinning or origin certificate validation from
successful Cloudflare fetch delivery. The optional `--receiver` must select a
receiver outside this account's zones and outside badssl.com to exercise P5.

## Historical OD08-1 procedure and observations

The following dated record is retained as history. Its instructions, predicates,
authorizations and default decisions are superseded by the current section above;
none authorizes an additional live run.

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

## Decision and alternatives

The dedicated enforcing service remains the selected boundary, with the three
contracts unchanged. Its requirements are checked DNS answers, a connection pinned
to a checked address, TLS verification for the original hostname, no redirects,
and request/response size and time bounds. It is one Worker per account and
environment, bound by the seeds (ADOPTION.md). The existing startTls implementation
has local proof but failed live P1. The selected userspace-TLS implementation adds
a WASM dependency, root-store upkeep and new certificate proof; it is future work.

The earlier alternatives remain unselected:

- Run `NodePinnedTransport` in a non-Worker runtime (an authenticated HTTPS relay
  or container), with a forwarding Worker. This preserves the contracts but adds
  another runtime.
- Use ordinary `fetch(url, {redirect: 'manual'})` after `validateDestination`, with
  size/time bounds. That would require contract edits: Penny ACCEPTANCE.md:24-26,
  CONTRACT.md:205 (INT-002), HANDOVER.md:130-134; Vector CONTRACT.md:158
  (WEBHOOK-001), docs/INTEGRATIONS.md:40-45; Spool ACCEPTANCE.md:24 and
  docs/ALERT-WEBHOOKS.md:40-46. URL preflight does not inspect DNS answers; the
  edge's observed P6 refusal of one private address cannot supply that guarantee.
  This alternative was not built or qualified by this probe.

The owner decision is settled for this result. Do not enable integrations or
change seed ACCEPTANCE to claim availability until the selected implementation
and all applicable guarantees are proved in their actual adopting editions.

## Probe procedure for a future authorized run

A shared Cloudflare account is allowed; it need not be empty. The account needs
a workers.dev subdomain and an account-scoped token with Workers Scripts edit
permission. Before building or deploying, the probe refuses if **either exact
name** `egress-service-probe` or `egress-probe-probe` already exists. Unrelated
Workers are allowed. The caller must name the account with `--account`, repeat it
with `--confirm-throwaway`, supply a matching `CLOUDFLARE_ACCOUNT_ID` and a nonempty
`CLOUDFLARE_API_TOKEN`. Strict argument and receiver-URL checks remain in force.
The historical `--confirm-throwaway` flag confirms temporary probe Workers in the
named account; it does not require a throwaway or empty account.

For OD08 the only authorized account was RunEditRun
`b20c0ca9cab0c2b70e13d7cf724b89bd`, using the existing credential wrapper below.
It injects the named stage-token key and fixes the account without exposing key
values. Set `OD08_ENV_HELPER` to the path of `briefs/_od08-env.py` in the
consolidation workspace, then run this from the Base checkout root. This is the
command form for a newly authorized run, **not permission to repeat the
completed three attempts**; do not use a raw key or `--break-glass`.

```sh
python3 "$OD08_ENV_HELPER" \
  CLOUDFLARE_API_TOKEN=CLOUDFLARE_RER_STAGE_TOKEN -- \
  node modules/egress-service/owner-probe.mjs \
  --account b20c0ca9cab0c2b70e13d7cf724b89bd \
  --confirm-throwaway b20c0ca9cab0c2b70e13d7cf724b89bd
```

An optional `--receiver https://<owned-receiver>/<path>` replaces the default
`https://httpbin.org/post`; choose a receiver outside example.com to exercise P5.

The source performs these phases:

1. Build and deploy `egress-service-probe` with `workersDev: false`, then deploy
   `egress-probe-probe` with a plain `EGRESS` service binding. Verify deployment
   and readback before the token-protected POST `/run` obtains independent rows.
   Request the egress Worker's would-be workers.dev URL for P4.
2. Upgrade the same caller, retaining its ownership state, with `EGRESS_NARROW`
   and `allowedHosts: ["example.com"]`. Keep strict deploy-kit readback. Only a
   successful readback permits POST `/narrow` to test runtime refusal. If the
   provider omits narrow props, classify **failed P5** with `narrowed: null` only
   after checking the matching pending upload/provider identity and all other
   bindings. The documented provider default `environment: "production"` is
   accepted on service readback; other extra fields or binding drift abort.
   Changed/present-but-wrong props and other deployment errors also abort.
3. Print P1–P9 JSON, then attempt to delete only Workers this run demonstrably
   created. Cleanup uses recorded owner state and the matching live provider
   version/deployment/etag identity. A queued deployment or pending intent alone
   is not ownership. Workers from collisions that this run did not create are
   never deleted. If cleanup cannot confirm creation or matching provider identity,
   or deletion fails, it retains local ownership state and reports a visible
   cleanup error for inspection. Confirm absence with an after-inventory; printed
   rows alone are not teardown proof.

Exit 0 means all row predicates passed; exit 1 means a completed table has failed
rows. An abort before a table exits 2. Interpret predicates with the qualifications
above, and inspect cleanup errors independently. The probe contacts example.com,
httpbin.org, badssl.com, localtest.me, nip.io, ipv6.google.com and the fixed resolver
cloudflare-dns.com; P6 also targets `https://10.0.0.1/` and `10.0.0.1:443` directly.

## Historical OD08-1 row predicates (not current instructions)

| Step | Live-only guarantee (DESIGN.md) | Expected outcome |
|---|---|---|
| P1 | Pinned startTls delivery | Receiver and https://example.com/ both return an HTTP status. Generic connection failure does not isolate the cause. |
| P2 | Bad-certificate refusal | wrong.host, self-signed, untrusted-root and expired badssl.com cases all return `egress_connection_failed`; meaningful certificate proof also needs working valid-certificate delivery. |
| P3 | Fixed DoH resolver answers | Random `*.example.net` returns `egress_dns_failed`; example.com returns HTTP or reaches the socket stage with `egress_connection_failed`. The negative-name expectation remains unresolved. |
| P4 | No usable public workers.dev route to egress | The would-be workers.dev request fails or returns 4xx/5xx; retain disabled-route deployment readback too. |
| P5 | Caller props read back and narrow | Strict props readback succeeds, then `EGRESS_NARROW` to the receiver returns `egress_destination_not_allowed`. Missing props is a failed row, never permission to invoke it. |
| P6 | Edge private-address refusal (informational) | Raw fetch and connect to 10.0.0.1 both fail (fetch 4xx/5xx qualifies); the service does not rely on this. |
| P7 | Redirect response returned without following | httpbin.org redirect to 169.254.169.254 returns 302 and that Location. |
| P8 | Refusal of names intended to resolve privately | localtest.me and 10.0.0.1.nip.io both return `egress_dns_not_public`; retain any raw DNS evidence separately. |
| P9 | AAAA-only egress (informational) | ipv6.google.com returns an HTTP status; a generic connection failure cannot isolate IPv6. |

Record JSON, run date, source commit, runtime, all attempts and teardown evidence.
Before seed adoption, prove P1, P2, P3, P4, P5, P7 and P8 with the selected
implementation and resolve the gaps above; a predicate alone cannot replace its
guarantee. P6 and P9 remain informational. Keep historical local-workerd proof
separate from edge and edition acceptance.
