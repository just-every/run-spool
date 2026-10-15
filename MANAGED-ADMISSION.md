# Spool managed admission

Spool keeps the project identity in `rer-project.json`, package `@errors/errors-workbench`,
and `errors-workbench` seed. Managed admission is optional. Local setup keeps the
native bootstrap and development outbox sign-in path.

The committed `rer-setup.json` also describes signed managed admission. The setup
token is hidden and generated; the independent session secret and token remain
server-only. A trusted installation provisions `AUTH_ORIGIN`, `OWNER_EMAIL`,
`SESSION_SECRET`, `SETUP_TOKEN`, `RER_OWNER_CLAIM_ISSUER`,
`RER_OWNER_CLAIM_INSTALLATION_ID`, `RER_OWNER_CLAIM_APP_ORIGIN`, and
`RER_OWNER_CLAIM_PUBLIC_KEYS`. The last binding is a JSON object mapping key IDs to
public ES256/P-256 JWKs. No private signing key belongs in the application.

`POST /auth/owner-claim` is mounted before the normal authentication dispatcher.
It accepts the signed token in the request body, validates the issuer, exact
application origin/audience, installation, configured email and five-minute
validity bound, and uses native operator-auth to create the first owner and
session atomically. `GET` presents confirmation without writes. Invalid claims
create neither sessions nor durable records. An existing operator, bootstrap or
claim ledger permanently refuses another claim. The additive claim migration
does not replace the existing owner or product rows. Preserve its ledger through
maintenance; ordinary product archives intentionally exclude authentication and
credential grants.

The optional editor requires both `RER_MANAGEMENT_ORIGIN` and
`RER_INSTALLATION_ID`. `/api/editor/config` rechecks the native owner session on
every request and grants at most 30 seconds of authority. Anonymous requests and
non-owner sessions receive no configuration. Sign-out/authority changes remove
the editor; ordinary focus revalidation preserves an unchanged open iframe.
Document CSP permits the exact configured management origin for frames and
ancestors. The management service must independently authorize the installation
and register the application origin in its own `frame-ancestors` policy.
The local network-edge browser acceptance does not establish hosted service
acceptance or a deployed edit-to-source cycle.

The Base delivery producer is exported from the reviewed Base revision recorded
in `base-copies.json` into `scripts/delivery/base` without Base tests.
`scripts/delivery/base/packaging.json` is Spool's packaging policy;
`setup.manifestFile` selects the committed canonical manifest. `rer-project.json`
records the exact setup digest, product recovery guidance and full verification
command. The managed workflow pins the reviewed delivery
trusted-build revision `86c8b37399c901bffd9a240dbd1148a65ec83b34`. Packaging emits
schema-2 payloads for the built Worker, assets and exact migration bytes.

After the ordinary build, run:

```sh
node scripts/build-delivery-artifact.mjs
node scripts/delivery/base/cli.mjs package --config scripts/delivery/base/packaging.json --output rer-package
node tests/owner-claim.mjs
node tests/owner-editor.mjs
node scripts/operations.mjs check
```

The output directory must be absent or empty. The two producer commands produce
different output directories (`delivery-artifact` and `rer-package`). Neither
command provisions, deploys, registers, tags, publishes or authorizes a provider
effect. Refresh generated descriptor/workflow bytes if setup or packaging policy
changes. The project setup command installs the pinned local build toolchain and
Chromium; it does not create an application owner.

The owner retains installs and receipts, live accounts, sender provisioning,
public visibility, tags and paid services. The final integrated source needs a
separate clean-history export and Base publish-check with zero findings and no
exclusions. These source changes do not claim that final export has passed.
