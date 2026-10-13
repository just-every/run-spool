# Spool agent instructions

## Run it locally

From the checkout root, follow this command order:

Use the declared Node 22.20.0 and pnpm 10.12.4 pins. The command list is the public order, not a script to replay blindly on a populated installation: export data before any reset when you need to preserve it, and import only into an empty destination.

```sh
node scripts/rer.mjs install
node scripts/rer.mjs setup
node scripts/rer.mjs dev
node scripts/rer.mjs outbox
node scripts/rer.mjs verify
node scripts/rer.mjs reset --yes
node scripts/rer.mjs export --target local --output exports/spool.jsonl
node scripts/rer.mjs import --target local --input exports/spool.jsonl --yes
node scripts/rer.mjs deploy --dry-run
node scripts/rer.mjs describe
```

Setup asks for the real first owner's email or reads it from the declared setup answers; do not put the address or secrets in shell arguments. It applies local migrations, claims or preserves the one owner, requests an ordinary sign-in message and stops its temporary app. Dev stays in the foreground and prints its health-ready URL. `rer dev` opens signed in: it prints `RER_SIGNED_IN` (the owner) and `RER_OPEN`, a link that carries this checkout's private dev key in its fragment. Open `RER_OPEN` in a browser on this computer and you land signed in as the owner; a small dev badge switches to the `member` persona (a signed-in operator who is not the owner, so the workbench stays closed to it) or signs out. Never share the link: the key is what keeps the outbox and dev sign-in closed to anything that reaches this port through a proxy or tunnel, and `reset` removes the key so every earlier browser session stops working. `--as member` (or `--as signed-out`) starts as another persona, and `--login` turns dev identity off so dev prints `RER_SIGN_IN` and a key-carrying `RER_OPEN` for the outbox instead: choose the newest message and follow its one-use link (no email is sent). Previews open the outbox the same way. `RER_OPEN` is for people at this terminal; scripts use `rer dev --json` or the key header. Run `outbox` in another terminal while dev is live to print the outbox link again. Credentials minted in a dev session (ingest, agent and deploy keys) are recorded as dev-minted and work only on a request that holds the key; mint them with `dev --login` when a client outside this checkout needs one. Stop dev before verify, reset or data transfer. Reset is destructive to the displayed local installation inventory. Export reads a stopped local installation; import requires an empty destination and creates no owner or project grants. Use the deploy dry run to build and validate locally; it makes no provider request. Run `node scripts/rer.mjs describe` for other supported commands and flags.

## Product and source boundaries

Spool is a local-first JavaScript evidence product with one owner identity and isolated projects. `src/**` is authoritative. Retained Base and family source records provenance; never regenerate or re-export product code over the application. Keep lowercase API and asset paths, package scope/name, seed ID, and edition/source identities stable.

Every private API handler must enforce the current owner session or its exact project grant itself, including direct transport calls; a route guard alone is insufficient. The HTTP dispatcher in `src/base/dispatch.ts` selects handler ownership but does not authenticate requests or catch failures. Keep actual Worker handlers and named exports in `src/server.ts`. Keep secrets in server-only modules. There are no private TanStack Start server functions; if one is added, use a server-only module and a dynamic import inside its handler, then prove unauthenticated direct transport is rejected.

First-owner setup claims the native owner through Base operator-auth at `/auth/bootstrap` with the private setup token, then uses the local development outbox for ordinary sign-in. An already claimed installation keeps its owner; migration `0004_operator_auth.sql` provides the `oa_bootstrap` claim ledger. Preserve the one-owner policy and single setup model. Managed first-owner claim and editor integration live in `src/editor`. Keep the signed claim route before the auth dispatcher and preserve its additive claim ledger. The optional editor config must recheck native owner authority; project grants cannot authorize it. Do not add a second secret, identity, or setup manifest model.

Scrub allowed event fields before persistence and review outbound evidence for residual personal data. Ingest grants authorize only their project ingest path. Agent grants are read-only and exact-project scoped. Owner writes require same-origin checks. Keep browser-origin policy project-scoped and preserve its ingest-only use. No captured telemetry executes commands or invokes external models.

Owner archives include private maps and browser-origin policy but exclude owner sessions and project credential grants. Restore requires an empty destination and does not create an owner or grants; preserve native archive v1/v2 compatibility and the shared Base portability engine. Retention is manual: preserve the visible cutoff, occurrence tombstones and deduplication horizon. BASE-DATA-003 owner-only project erasure is implemented on Base main's erasure helper (see docs/PROJECT-ERASURE.md); preserve every cascade, anonymised audit, receipt, restore-fence, five-minute and UI requirement in CONTRACT.md and ACCEPTANCE.md, and declare any new project table in `src/domain/erasure/declaration.ts`. Never report retention as completed project erasure. Source-map storage remains bounded to 20 flat maps of 256 KiB per project; R2 or warehouse storage is a future measured choice.

Setup, dev, verify and deploy dry run are local operations. Never infer deployment, provider, team, complete-capture or release acceptance from local source checks or tests. Actual owner-account deployment requires separately authorized account inputs and mail sender configuration. See [TARGET.md](TARGET.md), [CONTRACT.md](CONTRACT.md), [ACCEPTANCE.md](ACCEPTANCE.md), [OPERATIONS.md](OPERATIONS.md) and [HANDOVER.md](HANDOVER.md) for current boundaries and evidence.

Spool declares its own fonts (self-hosted Zilla Slab, IBM Plex Sans and IBM Plex Mono) in `public/fonts/fonts.css`, linked by `src/base/font-head.ts`. Both are product-owned and outside the Base copy records; the root head, the landing, docs and sign-in pages, and native `/auth/*` documents (through `fontDocumentResponse`) share them, while tokens and components live in `public/theme/spool.css`, so a Base refresh must not bring back Base's Outfit default.

`scripts/delivery/base/packaging.json` is product-owned policy over the pinned Base exporter. Regenerate the setup digest and producer workflow when policy or manifest bytes change.
