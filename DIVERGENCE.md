
## Deliberately disabled hosted mail (2026-11-15)

Spool accepts explicit `MAIL_PROVIDER=none` on rer 0.2.118, maps that choice into
the owner deployment, and declares its existing guarded `rer signin` route. The
native mail facade provides no hosted sender while off; sign-in links and member
invitations stay unavailable and alert delivery stays blocked. Sender requirements
are conditional, and native operations retains enabled-provider validation.
The managed candidate producer derives empty public mail input slots from the
owner declaration rather than requiring contradictory fixed Wrangler defaults.
These intentional adaptations of `scripts/operations-config.mjs` and
`scripts/delivery/base/spec.mjs` retain their upstream comparison baselines in
`base-copies.json`. No live deployment or provider qualification is claimed.

— Run Edit Run fleet, 2026-11-15.

## Egress TLS security update (2026-11-17)

Spool pins rustls 0.23.46 to address GHSA-vp88-798v-h67f,
GHSA-w44r-93j7-qv28, GHSA-c8m5-c952-6cm4 and GHSA-h2v8-394m-p7vv.
The TLS Cargo manifest, lockfile, README, production and test WASM, and
trust-bundle manifest are declared adaptations in `base-copies.json`, retaining
their original Base comparison baselines. Both rebuilt artifacts reproduce with
the declared toolchain. A later Base refresh must reconcile these adaptations
while retaining a patched rustls version.

— Run Edit Run fleet, 2026-11-17.
