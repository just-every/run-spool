# Adoption remains gated

These are future adoption instructions, not changes to Penny, Vector or Spool. Keep all three
outbound integrations off pending committed-source hybrid qualification and edition-specific
acceptance of the fetch path’s unpinned re-resolution and origin TLS policy limitations. The declaration
examples below are schematic: replace `SERVICE_GRANT_FROM_RECEIPT` with the exact grant object
specified in README, and choose destinations in the service owner's grant configuration.

# Adopting the egress service in a seed

All three seeds retain their binding types. Before adoption, review and update any contract
that promises every request is address-pinned or verifies the origin certificate; the hybrid
fetch path cannot make those guarantees (DESIGN.md). The service's binding stub already
satisfies Penny's `EnforcingEgress`, Vector's `TrustedTransport` binding and Spool's
`TrustedTransport` binding, as `tests/contracts.check.ts` proves at compile time. Each seed does
the same five things:

1. **Copy the module** beside the seed's existing copy of Base's integrations module. The service
   imports `../integrations/core/{destination,public-address,types}.ts`, so the two directories
   must be siblings. Leave out `tests/` if the seed does not run Base's tests. Keep `testing/`:
   the seed's own tests use it.
2. **Refresh the seed's copy of deploy-kit** from this Base. Owner declarations support named service grants with strict service and binding readback.
3. **Declare the service binding** in the seed's `deploy.json`, using a named `entrypoint` and a `grant` pinned to the service receipt, as described in README.
   Choose the grant in service-owned `EGRESS_GRANTS`; caller request data cannot widen it.
4. **Deploy the egress Worker first**, once per account and environment (README, *Deploy*). The
   service must receive complete service-owned `EGRESS_OWNED_ZONES` and
   `EGRESS_WORKERS_SUFFIX` (DESIGN.md); absent/malformed ownership fails closed. The seed's deploy refuses with `service-worker-missing` (resource `service:egress-service-<env>`)
   until it exists. Only one checkout should own the egress Worker's state file. Other seeds
   only bind it.
5. **Test with the dev double**: `createDevEgress` from `testing/dev-egress.ts`, given
   `nodeLoopbackSockets()` and `tls: await testTls(ca)` from `testing/wasm-tls.mjs` from `testing/node-socket.mjs`, a real loopback TLS receiver and
   a test CA. It is the service's own `EgressTransport` with test ports, so refusals, limits and
   HTTP handling match the deployed Worker. It must never be imported by deployable code.

## Penny (just-every/feedback-penny)

- Copy to `base/modules/egress-service/`, beside `base/modules/integrations/`. Penny's transport
  imports from `../../../../base/modules/integrations/` (`src/core/features/integrations/transport.ts:1-2`).
- `deploy.json`: `"services": [{ "binding": "PENNY_EGRESS", "project": "runeditrun/egress-service", "entrypoint": "EgressRestricted", "grant": SERVICE_GRANT_FROM_RECEIPT }]`.
  `PENNY_EGRESS` is the name in `src/core/shared/bindings.ts:2`. `integrationTransport` (`transport.ts:10-20`)
  keeps its own `validateDestination` and size checks, which is harmless duplication.
- Test: set `runtime.bindings.PENNY_EGRESS = createDevEgress({ receivers: { 'receiver.example.com': { port } }, openSocket: nodeLoopbackSockets(), tls: await testTls(ca) })`
  and drive one integration delivery to a loopback receiver that verifies the signature. Keep
  INT-002's missing-transport case, which proves `integration_transport_unconfigured` is visible.
- ACCEPTANCE.md:24-26 and AGENTS.md:138 may say outbound integrations are available **only after**
  live mandatory probe rows pass on the selected account (OWNER-STEPS.md). Until then, keep "outbound
  integrations remain disabled pending an enforcing egress service" and add "egress service
  built; awaiting complete qualification". HANDOVER.md:130-134 can name this module as the `PENNY_EGRESS`
  implementation now.

## Vector (just-every/projects-vector)

- Copy to `vendor/base/egress-service/`, beside `vendor/base/integrations/`.
- `deploy.json`: `"services": [{ "binding": "INTEGRATION_EGRESS", "project": "runeditrun/egress-service", "entrypoint": "EgressRestricted", "grant": SERVICE_GRANT_FROM_RECEIPT }]`
  and `"vars": { …, "INTEGRATION_EGRESS_POLICY": "public-dns-pinned-tls-v1" }`. The value is
  `EGRESS_POLICY` from `policy.ts`. `egressConfigured` (`src/core/features/integrations/outbound.ts:9`)
  requires both.
- Test: in `tests/e2e/integrations/outbound-native.mjs`, replace `NodePinnedTransport` plus
  the `globalThis.__vectorNetworkEdge` hook with `createDevEgress` (receivers
  `{ 'receiver.example.com': { port: receiver.address().port } }`, `openSocket: nodeLoopbackSockets(), tls: await testTls(cert)`).
  The private-DNS row becomes a second receiver entry with
  `answers: ['1.1.1.1', '127.0.0.1']` and expects `egress_dns_not_public`, with
  `connects` unchanged.
- Review CONTRACT.md WEBHOOK-001 and docs/INTEGRATIONS.md:40-45 for the hybrid DNS and TLS
  distinction before configuring the binding, then prove the edition flow and live probe there.

## Spool (just-every/errors)

- Copy to `src/modules/egress-service/`, beside `src/modules/integrations/`
  (`src/domain/alerts/webhook.server.ts:1-5` imports from there).
- `deploy.json`: `"services": [{ "binding": "INTEGRATION_EGRESS", "project": "runeditrun/egress-service", "entrypoint": "EgressRestricted", "grant": SERVICE_GRANT_FROM_RECEIPT }]`.
  The name matches `src/domain/alerts/types.ts:5`.
- Test: keep the m1 case that proves missing egress blocks without fetch
  (`evidence/spool-1/m1-35b117f-verify-excerpt.txt:8`), and add one delivery through
  `webhookService` with `INTEGRATION_EGRESS = createDevEgress(…)` to a loopback receiver.
- ACCEPTANCE.md:24 ("requires a separately installed enforcing egress service") stays true.
  Review docs/ALERT-WEBHOOKS.md:40-46 against the hybrid DNS and TLS guarantees. Say "installed" for a
  deployment only after the live probe passes on it.
