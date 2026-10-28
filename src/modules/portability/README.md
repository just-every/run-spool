# Portable installation data

To bring existing data into a seed, sign in as the owner and use its import
screen. First step: open this path on the destination app:

```text
/app/import
```

Upload a supported source export, review the plan and its differences, then
approve that exact plan to apply it. Reconcile the result against native data;
use Undo from the same history when needed. Base's reference accepts people JSON
here, not installation `.rer` archives. Editions adopt this same door
with their own supported readers and native adapters.

Use this module to back up and restore this installation, separately from
bringing records in through the reviewed import door. Its restore has no door
plan or Undo, and the door does not accept its `.rer` archives.

This dependency-free source module exports and restores one installation's D1
tables, R2 objects and optional named byte payloads. It is generalised from the
Penny and Orbit seeds, with atomic graph restoration from Lamp. Products retain
their data policy, erasure planning, authorization and interface.

The library works in Workers and Node with D1/R2 bindings. It makes no network
request and dispatches no product effect. Only the CLI contacts the product's
HTTP handler. Copying the module does not establish a product's complete data
ownership guarantee: include every binding, review transformations and extra
payload consumers, and prove the integrated round trip.

## Policy

`await createPortability({db, buckets, policy})` validates policy and the current
schema at construction. Apply the bookkeeping migration first. Export refuses
with HTTP 409 `import_applying` while an import is applying. Policy fields:

| Field | Meaning |
| --- | --- |
| `product` | Required archive product identity. |
| `excludeTables` | Additional exact names or prefixes ending in `%`. |
| `includeTables` | Explicit identity tables to include despite default identity exclusions. Mandatory platform bookkeeping tables cannot be included. |
| `derivedTables` | Virtual/FTS tables to regenerate; their shadow tables are excluded. |
| `secretColumns` | Per-table nullable base columns omitted at export and written as NULL. Primary keys and generated columns cannot be secret. |
| `exportRow(table,row)` | Pure, synchronous, idempotent transformation of encoded base cells. Restore writes its result verbatim; SQLite recomputes generated cells. |
| `importSafety` | Per-table, per-column nonempty finite sets of safe encoded cells, paired with `importRow`. Only writable non-key columns may be declared. |
| `importRow(table,row)` | Pure, synchronous, deterministic, idempotent normalization of staged rows in declared tables, before `validateStaged` and apply. Changes are bounded by `importSafety`. |
| `replaceableTables` | Bootstrap rows replaced in the atomic restore batch. Rows the destination's own migrations insert need no entry where the runner passes `migrations` (see "Migration-seeded rows"). Populated excluded dependents reachable through modifying FK actions refuse replacement. |
| `requiredConfiguration` | Setting names returned after restore for the owner to re-enter. |
| `validateStaged({db,tables,read,manifest})` | Read-only product validation before any object write; false or a thrown error refuses restore. `tables` names the staging tables for bounded SQL queries; `read` is a convenience for small tables. |
| `acceptedSchemas` | Map from an earlier full schema hash to `{upgradeRow(table,row)}`. Upgrade functions are pure and synchronous. No older schema is accepted by default. |
| `buckets` | Binding names mapped to `{prefix?,objectReferences?:{table,keyColumn}}`. Prefixes isolate an object namespace. References require exactly the distinct referenced keys: export checks its snapshot, and restore its staged rows (after `importRow`, before any object write), that each key is nonempty, under the prefix, not absolute and without `.` or `..` segments, and that the keys are exactly the bucket's archived objects, none missing and none extra; otherwise `object_references:<binding>`. |
| `extraPayloads` | Named `{produce,consume}` pairs. Producers return bytes or a byte stream. Consumers receive a verified byte stream and descriptor before D1 commit. |
| `partBytes` | Maximum part size, default 16 MiB, configurable from 1 KiB to 16 MiB. |

`bookkeeping.mjs` defines the mandatory `platformTables` list. These tables
belong to the current runtime or environment and never travel:

| Tables (exact names or prefixes ending in `%`) | Reason |
| --- | --- |
| `sqlite_%`, `_cf_%` | SQLite and Cloudflare internals. |
| `d1_migrations`, `_rer_deploy_migrations`, `_rer_portability_migrations`, `rer_migrations` | Destination migration history. Base uses the D1 and `_rer_` ledgers; RER Platform's runner writes `rer_migrations`. An old archive that still carries its source's ledger is placed by it (see below); its rows are never restored. |
| `rer_portability_%` | Transfer jobs, snapshots, staging, journals and recovery bookkeeping. |
| `ik_d1_assertions` | Import-kit CHECK guards, cleared within every successful migration or batch. Never owner data. |
| `rer_mail_development_outbox`, `rer_ai_development_outbox` | Local development effect captures. |
| `rer_dependency_keys`, `rer_dependency_pending`, `rer_dependency_codes` | Provider secrets and transient linking credentials. |
| `rer_command_receipts` | Command replay receipts tied to the source installation. |
| `rer_erasure_blobs`, `rer_erasure_guard`, `rer_erasure_scope`, `rer_erasure_rates` | Erasure work queues, transaction guards, working scope and local rate limits. |
| `rer_demo` | Local demo setup markers. |

`excludedTables` combines this list with the default identity exclusions `oa_%`
and `oc_%`. Policy may override those identity exclusions through `includeTables`,
but naming a mandatory platform table there refuses construction with
`platform_table:<name>` and a message identifying the table.
`excludedTable(name, policy)` always returns true for mandatory platform tables,
regardless of policy, so export cannot include them. A seed's own table inventory,
which refuses tables it does not know, uses the same predicate, so it does not
refuse a table Base created and never archives.

These are specific exclusions, not a blanket exclusion of `rer_%` tables.
Durable erasure receipts in `rer_erasure_operations`, installation identity in
`rer_dependency_installation`, retained links in `rer_dependency_link`, and mail
delivery receipts and state in `rer_mail_event_receipts` and
`rer_mail_event_states` remain portable unless product policy excludes them.
Seed-owned tables are likewise discovered and remain portable by default.

For native local CLI transfers, declare executable policy through
`localPortability({database, buckets, policyModule})`. `policyModule` is a
seed-root-relative path or a `file:` URL (including `new URL('./archive-policy.mjs',
import.meta.url)` in the seed adapter). Its real path must be a file inside the
seed root, and its **default export** must be the policy object:

```js
const allowedDomains = new Set(['example.org']);
export default {
  product: 'my-product',
  validateStaged: async ({read}) =>
    (await read('contacts')).every(row => allowedDomains.has(row.domain)),
};
```

The runner validates the module/export before applying data migrations. The
native transfer worker imports that same seed-owned entry point, preserving
functions and module-local closures. Modules should have no top-level effects:
preflight and transfer each load them in a separate process. Archive metadata
never selects executable policy. A module may also export
`createPolicy({db, buckets})` to bind payload producers and consumers to the
current transfer's database and buckets. Its default policy is validated during
preflight; the factory's policy is validated when the bindings are available.
Managed intake supplies its disposable source bindings to the same factory, so
its payloads come from the ZIP's own staged data. Intake compares source schema
objects with a fresh replay of the destination migrations. Portable tables must
exist there; retired or replaced objects require a matching historical definition
and the migration that removes it. The receipt groups those objects by type and
migration, with counts and hashes of sorted names. Unknown objects refuse before
native restore; the destination retains its own schema. Native runners can use
`requireEmptyTables` before creating a restore job; finalization still enforces
the atomic empty-table guards. Invalid paths, missing/invalid default exports,
and declaring both `policy` and `policyModule` fail closed. Serializable object
`policy` declarations remain supported; inline functions (including nested
schema-upgrade and payload callbacks) are refused instead of being dropped by
JSON transport. Container transfer currently refuses `policyModule` explicitly;
it continues to accept serializable object policies. Malformed primary or later
journal JSON is reported once as `invalid_archive` with exit 2 and a re-export
recovery command, before local data
migrations, without echoing archive content or parser diagnostics.

An installation migrated by Platform has `rer_migrations(name, sha256,
applied_at)` instead of Wrangler's ledger. Local transfers match each entry to
exactly one migration file by SHA-256 and preserve its application order. They
verify all local files are recorded and skip Wrangler; a pending file refuses
as `migration_ledger:unapplied` until Platform applies it. Unknown,
ambiguous or conflicting entries refuse with constant codes, without replaying SQL or
creating a second ledger.

For old archives containing only Platform's migration names, the seed adapter
may declare `platformMigrations: {prefix, dataOnly}` on `localPortability`.
Read `prefix` from the seed's own deploymentSpec packaging `migrationPrefix`
for this binding's migrations directory. It declares an alias `prefix + file`
for each file; it does not strip arbitrary prefixes. `dataOnly` is an explicit
list of installation-specific Platform seed entries without schema files.
Declare only SQL that seeds data and changes no schema: these names are omitted
from schema replay. This does not authorize replacing their rows; the archive
policy still controls that. Archive SQL and names never supply these declarations.
Custom replay runners can supply each plan entry's `aliases` and pass
`{dataOnly}` as `migrationReplay`'s third argument. Verified archive ledger
hashes take precedence over name-only placement where available.

### Leaving RER Managed: the Platform ledger rule

A Managed installation's D1 keeps its history in `rer_migrations`, which the
Platform runner writes; a native installation uses `d1_migrations`. The ledger
is deployment history, never product schema or data. Base maps it by migration
identity, name and SHA-256 of the file:

- Export from a Platform-ledger source records `manifest.migrationLedger` (see
  "Migration history" below) and never archives `rer_migrations` as a table.
- Import into a native installation matches every entry to exactly one
  checkout file by hash; a name may confirm that file but cannot point at
  another. A file the checkout does not have or whose content differs refuses
  as `migration_ledger:unknown:<name>`, a name on one file with the hash of
  another as `migration_ledger:conflict:<name>`, and the CLI prints the fix.
  A checkout file the Platform history lacks refuses at the preflight as
  `migration_ledger:unapplied`, naming the file; apply it with Platform first.
- Adapters with their own archive format (not Base's) call `mapMigrationLedger`
  instead of comparing ledger controllers: it returns the entries named by the
  checkout's files, or refuses with the same constant codes.

```js
import { mapMigrationLedger } from '@runeditrun/rer/portability-migrations';

// Export: the source's ledger rows (rer_migrations or not), as native identities.
const ledger = await mapMigrationLedger({ root, binding: 'DB', platformMigrations, entries: rows });
// Import: the archive's entries must map without refusal; write no ledger rows.
await mapMigrationLedger({ root, binding: 'DB', platformMigrations, entries: archive.ledger });
```

Call `nativeMigrationPreflight` before each native apply as below: a sole,
fully applied `rer_migrations` returns `{nativeApply:false}` for export and
import alike, so a seed's own guard must not require `d1_migrations`.

### Before an adapter's native migrations

Seed adapters sometimes prepare schema before calling `localPortability`.
`rer import` and `rer export` dispatch to the seed's portability adapter; a
check inside the later transfer cannot protect that earlier native apply.
Call `nativeMigrationPreflight` immediately before **each** such Wrangler step,
for both import and export. The maintained Node entry point is
`@runeditrun/rer/portability-migrations`; a vendored CLI uses
`scripts/base-cli/cli/portability-migrations.mjs`.

```js
import { getPlatformProxy } from 'wrangler';
import { join } from 'node:path';
import { nativeMigrationPreflight } from '@runeditrun/rer/portability-migrations';

// Inside the seed's local portability adapter, before its existing native apply:
const proxy = await getPlatformProxy({
  configPath: join(root, 'wrangler.jsonc'),
  persist: { path: join(root, '.wrangler/state/v3') },
  remoteBindings: false,
});
let nativeApply;
try {
  ({ nativeApply } = await nativeMigrationPreflight({
    root, db: proxy.env.DB, binding: 'DB',
    platformMigrations: { prefix: 'core-', dataOnly: [] },
  }));
} finally { await proxy.dispose(); }
if (nativeApply) {
  await store.run('Preparing archive schema', 'pnpm', [
    'exec', 'wrangler', 'd1', 'migrations', 'apply', database,
    '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc',
  ], { cwd: root, signal });
}
// Continue the seed's archive/attachment checks and localPortability transfer.
```

Use the seed's actual binding, database and deployment prefix, with the same
`platformMigrations` declaration on `localPortability`. Omit the declaration
when none is needed. The helper reads this binding's `migrations_dir` in the
root's `wrangler.jsonc` (default `migrations`) and hashes the original file
bytes. It uses the transfer's `destinationLedger` and `matchMigrationLedger`.
Platform history and archive transfer retain declared aliases, hash identities
and data-only entries. Native history additionally requires every recorded name
to equal a checkout filename: Wrangler skips files by literal name, so an alias,
hash-only relocation or unmapped data-only row cannot authorize native apply.
It does not split or execute the migration SQL. Pass the real target's
D1-compatible binding; inspection of another database or persistence directory
cannot authorize this apply. Keep
destination writers stopped and hold the adapter's normal operation lock
through inspection, apply and transfer. This local example authorizes no remote
provider operation.

| Existing history | Result before native apply |
| --- | --- |
| No migration ledger | `{nativeApply:true}`; ordinary fresh Wrangler setup. |
| Compatible `d1_migrations`, every recorded name exactly equal to its checkout filename | `{nativeApply:true}`; Wrangler may apply its pending files. Plain Wrangler names remain supported; tracked history must also match hashes and applied states. |
| Native alias-only or hash-only relocation, or an unmapped native data-only row | `migration_ledger:incompatible`; restore the matching checkout or reconcile through the owning runner before native apply. |
| Sole, fully applied matching `rer_migrations` | `{nativeApply:false}`; preserve Platform's ledger and skip Wrangler. |
| Any pending checkout file with Platform history | `migration_ledger:unapplied`, naming the file (`error.migration`); apply it through the owning runner first. |
| Multiple ledgers, even empty | `migration_ledger:multiple`; reconcile history through its owning runner. |
| Legacy `_rer_deploy_migrations` alone | `migration_ledger:runner`; use its owning runner, which can adopt the history. |
| Invalid ledger shape, row or binding | `migration_ledger:incompatible` or `migration_ledger:binding`. |
| Partial Platform batch or non-applied tracked row | `migration_ledger:uncertain`; resolve the incomplete operation first. |
| Unknown hash/name, ambiguous hash/alias or conflicting name/hash | `migration_ledger:unknown`, `:ambiguous` or `:conflict`; use the matching checkout and declaration. |

Refusals throw `PortabilityError` with status 409 and a constant `code`;
ledger values never enter these diagnostics. Propagate failures and stop before
native apply. IO and provider failures also propagate. A successful check
creates no ledger, changes no row and does not attest unrecorded historical
bytes in a plain Wrangler ledger. It never silently skips pending migrations.
RER's native `localPortability` invokes this same entry point in its
`migration-preflight` worker before its own Wrangler step, then reads applied
history again for transfer.

The implementation ships in the RER CLI, not the Worker portability module.
Package-mode seeds need a pinned `@runeditrun/rer` release containing this
export and an exact pin/lock update; version 0.2.77 does not expose it.
Vendored seeds need a reviewed Base CLI-copy refresh with
`node scripts/export-cli.mjs SEED_ROOT` from the selected Base source and their
normal copy/provenance checks. Copy the complete CLI dependency inventory,
not this file alone. Either route also needs the seed-owned adapter call above
before its earlier native apply. This Base change releases no package and
adopts no seed.

When a policy includes operator-auth tables, local dev identity still never
travels, and no policy option changes that: export drops `oa_sessions` rows of
kind `dev`, every credential recorded in `oa_dev_credentials` (and that table's
rows), and marks dev personas (`<as>@dev.localhost` operators) inactive with a
new authority version; import refuses with 409 (`dev_data`, exit 4 in the CLI)
an archive holding a `dev` session or `oa_dev_credentials` rows. Only tables with
operator-auth's own columns are touched.
A policy may preserve people, their external identity bindings and the original
owner claim. Such a destination keeps that claim and recovers access through
ordinary native sign-in; setup does not grant another owner. Other tables are
discovered automatically. Exclusion rules follow SQLite's ASCII identifier case matching.
Unlisted virtual tables, hidden virtual-table columns and foreign keys into
excluded tables fail by name. The product must explicitly regenerate derived
data. A schema upgrade may change columns but cannot silently omit tables.

Provider link keys and transient provider sessions never travel. Export marks
retained dependency links as needing re-link and turns provider sign-in and
first-setup enablement off. When `oa_auth_settings` is included, each export
advances its authority generation; importing then exporting therefore changes
that generation and the content hash, while retained domain and identity rows
remain equal. Re-linking keeps the installation sector and person bindings;
restored provider sign-in remains off until the owner explicitly enables it.

Included standing policy approvals retain their provenance and run references,
but export revokes them in the snapshot. The source approval stays unchanged.
Restore refuses an archive containing a live approval, even with valid archive
checksums. The destination owner must approve its policies again. Included
operators retain their durable `last_signin_at` when sessions are scrubbed.

SQLite VIRTUAL and STORED generated columns retain their visible schema metadata
and original table SQL. Only writable base cells appear in archived rows or
restore inserts; the destination's migrated schema computes generated values and
maintains its indexes. Snapshot and staging tables retain native generated
expressions, column affinities and collations, while leaving final constraints
to the atomic destination restore. Normalization updates base cells, so generated
attachment references and `validateStaged` reads see recomputed values. Nullable
secret base cells become NULL before generated snapshots are normalized. A
generated column cannot itself be redacted: exclude the table or change the
product schema/policy if its computed value must be secret. Ordinary-column
metadata and row encoding are unchanged. Ordinary-table archives using the
v2 integrity-checked format continue to import into the same schema; see the version
1 refusal below.

An archived INTEGER-affinity base cell outside JavaScript's safe integer range fails before
precision is lost. Cells are null, strings, finite numbers or `{blob:base64}`.
Column affinity and NOT NULL are checked before staging. R2 metadata moves with
the bytes. Large objects span parts and restore through multipart upload with at
most one 5 MiB upload buffer. Extra payload consumers own their own transaction,
idempotence and recovery; D1 cannot roll back Durable Object or external state.

### Bounded import normalization

Use `importSafety` with `importRow` when restored records must start in a safe
state, even if an older archive contains active connections or credentials:

```js
export default {
  product: 'my-product',
  importSafety: {connections: {status: ['inactive'], token: [null]}},
  importRow(table, row) {
    return {...row, status: 'inactive', token: null};
  },
};
```

The hook is called only for tables declared in `importSafety`, after staging
and before `validateStaged` or apply. Mandatory development/provider-data refusals
run first; normalization cannot bypass them. It must return exactly the writable columns
of its input row, preserve primary keys and every undeclared column, and change
declared columns only to their listed safe values. Unchanged values need not be
in the safe set. The hook must be pure, synchronous, deterministic and idempotent;
keep external effects out of it. Generated columns recompute from the normalized
base cells. Without this pair, import behavior is unchanged.

Construction refuses an unpaired hook or declaration, unknown table or column
names, primary keys, generated columns, empty safe sets and malformed encoded
cells. Safe values use the ordinary cell encoding: null, strings, finite numbers
or `{blob:base64}`. The destination policy supplies the hook; an archive cannot
supply executable normalization.

The import job persistently journals the summary in `metadata.safetyChanges`.
`imports.status(id)` and the `importArchive` receipt expose it as `safetyChanges`,
an array of `{table,column,value,rows}`. Each entry counts actual changed rows for
that column and safe replacement value; a row changed in two columns contributes
to two entries. The summary contains no original values or row records. Durable
checkpoints keep retries from counting changes twice. Human `rer import` output
prints these counts too, for example `3 automations imported with status="inactive"`.

Archive integrity checks still verify the original archived contents. This
summary is separate from the erasure journal: normalization does not bypass its
fence or change journal adoption. Existing atomic D1 apply, owned-object rollback,
extra-payload recovery responsibilities and transfer erasure behavior still apply.

## Archive and durable jobs

The UTF-8 JSON-lines archive has a manifest, indexed checksummed parts and a
closing record. `readArchive(stream)` uses the shared bounded, fatal UTF-8 line
reader. The default maximum line size is 24 MiB; callers can set a smaller bound.
No runtime or CLI materializes the whole archive. The manifest opens the archive and holds the final part count and payload hashes, so an export builds all its parts in the job before any byte is written; `exportArchive` and `importArchive` take an optional `progress` callback (`progress.mjs` turns its events into throttled lines with a time-left estimate). Readers enforce a 16 MiB
canonical UTF-8 part limit; `readArchive(stream,{partBytes})` can lower it.
Import uploads enforce the policy's part limit before any staging write.
A part has at most 1,000 rows;
R2 and payload parts contain base64 byte chunks.

The manifest includes product, export time, persistent random installation
identity, schema identity, table SQL/columns/counts/FK dependencies, object and
payload sizes/hashes/metadata, exclusions, required configuration, part count and
the source erasure epoch/journal. The closing `contentHash` hashes canonical JSON
of the schema, normalized rows ordered by archived primary key (original row order without a key),
object metadata/hashes, payload hashes and required configuration. Keyless row
parts also preserve the original rowid, including gaps, for restoration and
erasure matching. Export time,
source identity, job ids and boundaries do not affect equivalence.

Schema identity covers table definitions (including constraints and generated
expressions), explicit indexes (including uniqueness and partial predicates),
views and triggers. Row exclusions do not omit indexes and triggers attached
to excluded tables, including platform bookkeeping tables. Names with the literal
internal prefixes `sqlite_` and `_cf_` remain exempt. The complete additional
definitions travel in `schemaObjects`. Explicitly acknowledged v1 recovery uses
the historical exclusion projection only when placing its old backup within
native migration history; the live destination and ordinary v2 inventories
still use the complete catalogue. A single SQLite lexer reads the original
SQL before removing trivia. Identity records each token's class and canonical
value, plus a deterministic spelling: a single space separates neighbours
exactly when concatenating them would change their tokenization. The complete
joined stream is tokenized again and must reproduce those same tokens.
Comments and harmless inter-token whitespace therefore compare equally, while
`x '31'` and `x'31'`, separated minus signs, numbers and combined operators stay
distinct. No regular expression rewrites SQL.

Quoted identifiers (double quotes, backticks, brackets, or a single-quoted string
used as a name), strings, blobs, numbers, variables and ordinary identifiers keep
their exact spelling. Only unambiguous reserved keywords fold ASCII case.
Fallback/JOIN/window keywords retain their spelling: for example, SQLite can
interpret `DEFAULT ABORT` and `DEFAULT abort` as different string defaults.
Unicode case and quote styles are never normalized. The lexer follows SQLite's
[`sqlite3GetToken`](https://github.com/sqlite/sqlite/blob/master/src/tokenize.c)
and the keyword fallback rules in
[`parse.y`](https://github.com/sqlite/sqlite/blob/master/src/parse.y).
The original DDL is authenticated by `archiveHash`.

Unsupported or ambiguous SQL refuses with `schema_mismatch:unsupported_sql` and
the existing original-installation re-export/recovery instructions; it never
receives a shared or empty identity. This includes NUL and ill-formed Unicode,
BOM at token start, vertical-tab whitespace, unterminated quotes/brackets/block
comments (including bare `/*`), malformed/odd-length blobs, invalid numeric
separators or numeric identifier suffixes, malformed named/Tcl variables, and
unknown ASCII punctuation. Valid decimal/hex/exponent/underscore numbers,
SQLite's longest operators, question-mark and named/Tcl variables, LF/EOF line
comments, and terminated block comments are recognized. SQLite may accept some
of the refused whitespace or EOF-comment forms; re-export with supported DDL
rather than silently discarding their bytes. Virtual tables remain unsupported.

Older version 2 archives first verify their original raw-DDL, table-token, or
complete-object-token schema checksum and complete archive proof. A read-only
historical checksum codec projects the real lexer's tokens into those old wire
encodings. Its lossy result never decides compatibility: complete definitions
are always compared through the new typed token identity. Compatibility then uses
any complete `schemaObjects` inventory the archive carries, without rewriting
its authenticated manifest or parts. Without that inventory, the original
presence or absence of indexes, views and triggers cannot be established from
table SQL or migration names alone, even when the destination has no such
objects. Normal restore refuses `schema_mismatch` and the CLI gives the existing
re-export recovery instructions. This also catches removal of an old object's
definition rather than assuming missing evidence means the objects match.
Re-export from the original installation to carry the complete definitions.
A new archive explicitly records even an empty object inventory, so later
additive migrations can still be placed normally. The separate acknowledged
v1 recovery path remains an explicitly unverified recovery, as documented below.
Version 2 backups without that inventory have their own acknowledged recovery below.

New exports use archive version 2. The closing `archiveHash` is SHA-256 of
canonical JSON `{manifest,parts}`, where `manifest` is the complete manifest
and `parts` is the ordered array of verified part SHA-256 strings. This binds
source identity, erasure epoch/journal, export time, all table and policy-visible
metadata, and every part field (including original rowids). It is required on
finalize and checked before any R2 write, extra payload consumer or D1 restore
commit. Local `rer import` verifies the whole input before even applying
destination migrations. `contentHash` remains the content-equivalence digest;
`archiveHash` changes when export time, source metadata or part boundaries change.

Older version 2 archives may contain tables now classified as mandatory platform
bookkeeping. Import verifies the original archive in full, including its
manifest, every part, `contentHash` and `archiveHash`; excluded rows still count
in those integrity checks. Their rows are never staged or restored. Only these
mandatory tables are removed from the effective schema before compatibility
checks; this does not waive checks on any remaining table. `imports.status(id)`
reports their names in `skippedTables`. File and HTTP CLI imports print one line
when any are skipped: `Skipped platform bookkeeping tables: <names>.`

An old archive may carry an empty `ik_d1_assertions` table. Import skips it so
later import-kit guard migrations do not count as writes to restored data.
An archive declaring rows in that table is refused with
`invalid_bookkeeping_rows:<table>` (HTTP 409): a successful guard unit cannot
leave those rows committed.

Version 1 archives lack this binding and are refused with
`legacy_archive_unverifiable` (HTTP 409; local `rer import` exit 4), before
restoration. Upgrade the original installation and export a new archive.
Changing an old archive's version or recomputing its part checksums cannot
authenticate it. If the original installation is unavailable, use the explicit
[backup-only v1 recovery](#backup-only-v1-recovery) below. Normal import still
requires version 2 integrity.

## Acknowledged recovery of older version 2 backups

A fresh export from a current rer is preferred whenever the original installation
is available. Current archives carry the complete schema inventory and restore
without any acknowledgment. Version 2 backups written by rer 0.2.79 or earlier
can lack `schemaObjects`. If only such a backup remains, the owner can explicitly
accept that its schema objects are unverified:

```sh
rer import --input exports/retained.rer --yes --acknowledge-unverified-schema-objects
```

This accepts only the missing inventory. Ordinary import still refuses
`schema_mismatch:legacy_schema` before staging. The acknowledgment never accepts
version 1 metadata; that separate recovery still needs both v1 flags below.
The destination must be empty under the existing product emptiness rule:
non-migration rows in product tables refuse `target_not_empty:<table>` before
staging, including before a local runner applies pending product migrations.
Finalization repeats the normal emptiness check and atomic guards.
The normal restore maintenance lock remains held throughout staging and restore.

The destination runner must replay its own applied migration files. Every
archived table, column, dependency and table definition must match a compatible
point in that history, with only the supported later additive changes. Recorded
migration names must form an ordered compatible subset of the destination's
history; unknown names, incompatible columns or definitions, uncertain migrations
and unsafe later data changes refuse before staging, naming the mismatch.
Older name-only migration ledger rows are accepted for this acknowledged path;
ledger hashes, when present, must still match. Platform ledger rows are verified
against the archive parts and skipped, never installed over destination history.

Indexes, views and triggers come only from the destination's migrations, never
from archive SQL. Recovery writes rows and assets through the normal integrity,
authentication, explicit confirmation, safety and final erasure-fencing checks.
Seed-owned authority checks, including private-key matching, remain the seed's
responsibility and are unchanged.

The completed restore job and returned receipt carry `schemaUnverified`, with
its reason (acknowledged recovery of a version 2 archive without schemaObjects),
source identity, export time, acknowledgment time and archive hash. The local
command prints this secret-free receipt. A current archive records no such
receipt, even when the flag was supplied. Preserve the original backup and the
receipt; export a new current archive after recovery.

## Archives across later additive migrations

An archive restores into an installation whose schema differs only by migrations
applied after the archive was made, when those migrations are additive: new
tables, new columns that are nullable or have a default, and indexes, or the
preserving CHECK rebuild described below. The
archive's tables restore with their archived columns, later columns take their
defaults, and later tables stay empty unless their eligible seed or backfill is
replayed below. This applies to normal v2 import and to backup-only v1 recovery.

The Base CLI runners (local Workers and container) pass `createPortability` a
`migrations` replayer (`migration-history.mjs`, Node only) built from the
destination's applied migration ledger and migration files, with each file's
SHA-256. The ledger is `_rer_deploy_migrations`, `d1_migrations` (Wrangler or
the deploy kit) or, on an installation RER Platform installed, its exact
`rer_migrations(name, sha256, applied_at)` ledger, read in application order
(rowid) and refused while it holds a partially applied file. Import replays
them into a scratch database to find the archive's place in that history:

- Archives record the applied migration names in `manifest.migrations` (since
  additive restore). Every recorded migration must be applied here, and
  replaying exactly those must give the archive's schema identity.
- Archives exported from an installation RER Platform migrated (a Managed
  installation leaving for native) also carry `manifest.migrationLedger`:
  `{origin:'rer_migrations',entries:[{name,sha256}]}` in application order,
  each entry named by the exporting checkout's file with that SHA-256, so
  `manifest.migrations` lists native file names whatever prefix Platform
  recorded. Where the exporter has no checkout files (a hosted export), the
  ledger's own names are kept beside their hashes. Import resolves each entry
  by hash exactly as it does an archived ledger table (next item), so a
  Platform prefix needs no declaration and a changed file refuses. Platform's
  ledger is never imported as product tables. Native sources record no
  `migrationLedger`; their archives are unchanged, and v1 and earlier v2
  archives remain importable.
- Older archives that still carry their source's migration ledger as a table
  (`rer_migrations` and the other ledgers above, from before they became
  bookkeeping) are placed by it. Every name it records must be applied here,
  with the same file hash (the destination ledger's, else the replayed file's),
  or the import is refused with `schema_mismatch:migration_history:<migration>`
  naming the first that differs; replaying exactly those must give the archive's
  schema identity. Every other applied migration is later, wherever the
  destination's history orders it. `importArchive` reads the ledger rows from
  the verified file and passes them to `imports.create(manifest, actor,
  {ledgers})`; staging refuses any part whose ledger rows differ from them.
- Other older v2 and all v1 archives do not record them; the latest prefix of
  the applied migrations that gives the archive's schema identity is used.
  Migrations that change no archived table (indexes, excluded tables) cannot be
  told apart there and are reported as later.

Restored rows never pass through the later migrations, so each of them may
contain only `CREATE TABLE` (not `AS SELECT`), `CREATE INDEX` and
`ALTER TABLE ... ADD COLUMN` (SQLite allows only constant defaults there) on the
restorable tables. A later migration with any other statement that names a
restorable table, such as an `INSERT`, `UPDATE` or `DELETE` that purges or
backfills rows, is refused with `schema_mismatch` unless admitted or replayed
below. Bounded trigger and view creation/removal changes only schema. Statements that
touch only excluded tables are allowed. A data statement (`INSERT`, `REPLACE`,
`UPDATE` or `DELETE`, including `INSERT ... SELECT` and a leading `WITH`) is
judged by the table it writes: when that table is outside the restorable
catalogue (excluded, derived or platform) and no trigger or foreign key action
(`ON DELETE`/`ON UPDATE CASCADE` or `SET`) carries its writes into a catalogue
table, it changes no restored row and is allowed whatever it reads. Such a table
then holds live rows the restore lacks, so a later statement that copies it into
a catalogue table is refused. A statement this parser cannot bound to one table
keeps the rule above. Each chunk a runner's splitter hands over is first split
again where SQLite itself ends statements (`sql-text.mjs`, sqlite3_complete's
state machine): a trigger ends only at `; END ;`, so `CASE ... END||x` in its
body, quoted or commented semicolons never end it, and Wrangler's splitter
gluing such triggers to the statements after them changes nothing. `rer
import` replays the installation's migrations with that splitter too. A
statement names a table only through an identifier that can be one: SQL
keywords outside table position, function names (also table-valued ones such as
`pragma_index_list(...)`), the column of a qualified `t.column`, string and blob
literals, numbers and comments never count. Text Base cannot read to a
statement boundary, such as an unclosed block comment, is refused. An archived table the archive holds no
rows of restores empty, so an `UPDATE` or `DELETE` of it changes nothing and is
allowed regardless of what it reads: no row can change or fire a trigger. An
`INSERT` into it must qualify for replay below. For archives without a migration record,
every migration after the earliest prefix that gives the archive's schema is
checked, since the archive may predate any of them.

A complete five-statement `CREATE TABLE copy AS SELECT` / `DROP TABLE` /
`CREATE TABLE` / `INSERT ... SELECT` / `DROP TABLE copy` sequence within one
migration is admitted when every column is copied back unchanged and, for a
populated archived table, its rowid is copied back too. The copy must be local
to the sequence. Only CHECK clauses may differ; column declarations, defaults,
collations, other constraints and table options remain unchanged. Manifest
counts identify empty tables without another row scan. Restore uses the
destination definition, so a row rejected by its CHECK fails the whole atomic
restore; no row is skipped or coerced. Other statements still face the usual
data classifier, and a proven preserving block is not a competing backfill writer.

A backfill of a catalogue table is **replayed** instead of refused when it is
an eligible `INSERT ... SELECT` (or `INSERT ... VALUES`) or `REPLACE`. A table
the archive carries keeps its archived rows, including when it carries none:
the replay runs over the rows the live migration would have found there. It
must name its target columns and be the table's only later writer. For a table
with `AUTOINCREMENT`, carried-table replay is refused: the archive does not
retain `sqlite_sequence`'s high-water mark, so generated keys could differ.
Reads of a keyed table's unarchived hidden `rowid`, `_rowid_` or `oid` also
refuse, including through views: restoring its keys can change physical rowids.
For a table the archive lacks (one a later migration adds), finalize empties the table
(resetting its `AUTOINCREMENT` counter, as the live upgrade created it).
Finalize runs the eligible writes in migration order, exactly as written,
after every archived row is inserted and while the destination's triggers are
still dropped, in the same atomic D1 transaction as the rest of the restore. The
table then holds what the live upgrade gave it. Time functions such as
`strftime(..., 'now')` take the restore's time, as they took the upgrade's; an
`INSERT ... SELECT` without `ORDER BY` assigns new keys in the order SQLite
scans the restored rows. Rows the restore normalizes (import safety) are read
as restored. The restore is refused with
`schema_mismatch:migration_data:<migration>` instead when a write is not an `INSERT` or
`REPLACE`, reads any table other than archived ones and itself (including through
a view resolved from applied migration history), selects `*` or
a secret column, when a trigger on it or a foreign key action from it reaches a
catalogue table, when any other later statement writes it (directly or through
a trigger) or changes its columns other than by `ADD COLUMN` (allowed only when
every replay names its columns), when the statement cannot be bounded, or when
it writes a table that a bucket's `objectReferences` names: references are
checked on the staged rows, before any object write.
A failed or interrupted apply leaves no replayed row; finalizing again replays
from the start.
Read-only trigger bodies, including RAISE-only guards, add no write dependency.
Eligible constant seed INSERTs replay too. Statements confined to tables added
after the archive retain their existing admission when they need no replay;
an INSERT reading a view must still resolve entirely to carried tables.

A table created and dropped by the applied history remains a read dependency
even though it is absent from the destination. When its single CREATE, bounded
INSERT fills and DROP all follow the archive, finalize can reconstruct that
transient table in migration order, consume it and drop it in the same atomic
transaction. Its fills may read archived cells and new tables reconstructed by
the same plan; those dependencies must all qualify. Transient foreign keys,
writing triggers and other schema mutations do not qualify. Unsupported
transient reads keep the prior migration-data admission or refusal, and are
never scheduled against a missing table. No archive format change is needed.

The same check runs when the archive's schema identity equals the destination's:
a later migration that only purges or backfills rows leaves the schema unchanged,
yet the archive's rows never passed through it. Eligible carried-table backfills
replay here too; other rewrites are refused with
`schema_mismatch:migration_data:<migration>` (local `rer import` exit 4, naming
the migration) before any staging or import job; one whose later migrations only
add indexes or touch excluded tables restores as usual. Without a replayer, an
archive whose recorded migrations the destination's ledger has outgrown is
refused with `schema_mismatch:migrations`, since those migrations cannot be read;
an archive with no migration record cannot be placed there and restores as before.

Then each archived table must still exist with the same leading columns, types,
keys and constraints; its definition may differ only by added column definitions,
as `ALTER TABLE ADD COLUMN` writes them. Anything else, including a dropped,
renamed or retyped table or column and a migration the archive has but this
installation lacks, is refused with `schema_mismatch` (local `rer import` exit 4)
before any staging or audit write. Without a replayer (the HTTP handler, direct
bindings), only identical schemas and `acceptedSchemas` restore.

The import status and CLI receipt carry `bridged`: `migrations` (the later
migrations bridged), `tables` (later tables, left empty unless replayed),
`columns` (later columns per table that took defaults), `fromSchema` and
`toSchema`, and with any replay `replayed`: one `{migration, statement, table,
rows}` per replayed statement in the order run (`statement` is its index, from
0, in the migration's split statements, `rows` the rows it wrote, recorded in the same
transaction). The import job keeps it as the restore's journal of replays and
v1 recovery adds it to its audit record. `archiveHash`, `contentHash`,
the erasure fence and v1's own checks are unchanged.

## Backup-only v1 recovery

When your only backup is a version 1 archive and the original installation is
gone, the Base local Workers CLI provides an explicitly acknowledged recovery.
Use a separate, empty installation with the same product schema, or one that
differs only by [later additive migrations](#archives-across-later-additive-migrations),
and the same portability policy. Keep its writers stopped. Do not run setup or claim an owner first:
recovery also refuses populated identity, excluded and normally replaceable
tables, and any objects in the declared buckets. It does not merge or overwrite
existing installation data. Remote and container recovery are not supported.

1. Keep the original v1 backup untouched. Obtain a fresh runnable checkout of
   your product with this CLI, install its dependencies with `rer install`, and
   copy the backup to `./exports/backup-v1.rer`. On macOS/Linux, make that copy
   owner-only with `chmod 600 exports/backup-v1.rer`. Input files must be regular,
   private, single-link files; do not use a symlink.
2. Read the verification limits below, then run from that empty checkout:

   ```sh
   rer import --input exports/backup-v1.rer --legacy-v1 --yes \
     --acknowledge-unverified-metadata --output exports/recovered-v2.rer
   ```

   `--yes` confirms restoring data. The separate
   `--acknowledge-unverified-metadata` accepts the missing v1 metadata binding;
   `--yes` alone cannot authorize legacy recovery. `--output` must name a new
   safe archive path, inside `exports/` or an absolute path outside the checkout.
   The command verifies the input before destination migrations, restores it,
   and finishes by writing and verifying a fresh owner-only v2 export. An
   existing output is refused. A v2 input cannot use this recovery mode.
3. Keep `recovered-v2.rer` with your backups. Ordinary
   `rer import --input exports/recovered-v2.rer --yes` accepts it in another
   empty installation. Re-enter the reported required configuration and recover
   owner access according to your product's identity policy; provider links
   still need explicit re-linking. Check the recovered content before normal use.

Recovery verifies all checks v1 carried: schema checksum, each ordered part's
checksum, part/table counts, row order/types, binary sizes and hashes, the
closing content hash and completeness. It validates the carried erasure journal
and refuses rows matching its tombstones or any destination erasure fence.
Product validation, foreign keys and normal restore safeguards still apply.
Any mismatch refuses recovery; this mode does not repair damaged archives.

Recovery needs a new installation. SQLite, migration and transfer bookkeeping, the
storage tables of FTS5 indexes (`<index>_data|idx|content|docsize|config`; the index
itself is still checked through its own SELECT) and the rows the destination's own
migrations seed may exist; the seed rows are compared with a scratch replay of the
applied migrations (Node runners) and must be unchanged. Any other row refuses with
`legacy_target_not_empty`, before staging and again inside the restore batch. A table
the policy lists in `replaceableTables` is replaced by the restore as usual.

V1 cannot authenticate the complete manifest: source identity, export time,
erasure epoch/journal, rowids and other metadata lack the v2 archive binding.
Checksums are consistency checks, not proof of authorship. A missing or altered
erasure record cannot be reconstructed, and deletions after the backup are
unknown. The new v2 export binds the recovered data and metadata from recovery
onward; it cannot prove the original v1 metadata was authentic.

The installation records `legacy_v1_unverified_restore`, the explicit metadata
acknowledgement, claimed source identity and export time, output path and restored content
hash in `rer_portability_recovery_audit`, atomically with the restore. This
additive, local bookkeeping table survives transfer cleanup and is excluded
from data exports. No historical migration is rewritten. If the final v2
export fails (for example, disk full), the restore and audit remain: preserve
the installation, resolve the output problem and run ordinary `rer export
--output exports/recovered-v2.rer`. The recovery command reports failure until
its v2 output succeeds; do not reset the recovered installation to retry.

`exports.create(actor?)` copies all tables in one D1 batch. Product writes may
continue after that snapshot. R2 listing records size and etag; changes or missing
objects fail subsequent reads. D1 and R2 do not share a cross-binding transaction.

The direct service factory `createPortability` accepts an optional synchronous
`onExport({id, actor, scope})` callback returning `[sql, args][]`. Its SQL is
appended to that same snapshot/job-creating D1 batch. A thrown callback or failed
statement refuses creation; failed SQL rolls back the job, snapshots and audit
rows together. With no hook, export behavior is unchanged. This records job
creation, not successful download: a later build, file-write or download failure
does not erase a committed creation audit.

This hook applies to exports created through that service, including the file
adapter used by CLI exports. `createPortabilityHandler` does not accept or
forward `onExport`; the HTTP export handler has no audit hook.

`id` is the export job id, `scope` is the constant `'installation'`, and `actor`
is the opaque caller id, with the direct/CLI sentinel `'direct'` normalized to
`null`. Job ownership still stores `'direct'` for existing direct callers.
The callback receives no names, emails, IdP identifiers, tokens, record data,
object keys or file paths. Pass only opaque operator ids as authenticated actors.
The seed owns audit storage, migrations, retention, erasure and archive policy;
Base adds no audit table. For a CLI installation export, wire the seed's existing
`operation_audit` schema to action `installation.export`, actor_id `NULL` and
feature `rer export`, for example:

```js
const service = await createPortability({db, buckets, policy,
  onExport: ({id, actor}) => [[
    'INSERT INTO operation_audit(id,action,actor_id,feature) VALUES(?,?,?,?)',
    [id, 'installation.export', actor, 'rer export'],
  ]],
});
```

Adapt the statement to the seed's schema and use the service in its existing
export adapter. Hooks return SQL only; external side effects cannot share the
D1 transaction. Do not write these events to the erasure tombstone journal.

Transfer bookkeeping lives in sidecar tables, so product tables up to D1's
100-column limit retain the full column and binding capacity. A keyless table
with 100 columns or generated columns restores its rowids with two updates in
the same atomic batch.
Schemas shadowing all three SQLite rowid aliases refuse export at construction.
Encoded projections that exceed D1's SQL statement limit also refuse construction
by table name. Product-only staging keeps restore queries small even with long
column names.
Advance normalizes the durable snapshot, sorts archived keys and checks attachment
references again before completing the archive.
The shared D1 transport preserves mixed-script text through SQLite decoding and
accounts for workerd's whole-call string width. Snapshot and archive-segment
reads are bounded before crossing the provider boundary; staging and restore
transactions remain atomic.
`exports.advance(id,{expectedPart,maxParts})` commits durable bounded parts;
`expectedPart` makes a lost-acknowledgement retry a no-op. Status reports progress;
download streams completed jobs. Abort removes snapshots and stored parts.

`imports.create(manifest,actor?)` creates staging under one durable import lock.
Upload parts strictly in order. Each upload stages rows and archived JSON in
batches bounded by D1 transport bytes, checkpointing each batch atomically.
A same-index/same-hash retry resumes an interrupted part or acknowledges a finished
part; different content returns 409. Reassembled bytes pass the part checksum
before completion advances. Staged data stays private until finalization.
Finalize requires the closing `archiveHash` and verifies all
parts, semantic contents, destination
emptiness, erasure, object references and product invariants. R2 ownership
is recorded after the empty-namespace check. Verified object writes precede one atomic D1 batch, with
deferred FKs, trigger suppression/recreation, replaceable rows, staged inserts,
journal adoption and completion. FK cycles and self-references restore together.
An unsuccessful commit removes only owned objects. A lost commit acknowledgement
is resolved by reading durable completion before any cleanup.

### Migration-seeded rows

A fresh destination already holds the rows its own migrations insert, such as a
seed's default settings. When the runner passes `migrations` (Node runners: a
scratch replay of the destination's applied migrations), finalize treats a target
table holding exactly those rows as empty: the archive's rows replace them in the
restore batch, or they stay when the archive predates the table (an additive
bridge). The batch repeats the check. Any other row refuses with
`target_not_empty:<table>`, which the CLI reports with the table's name and the
export, reset and import commands to run. A Worker import has no replay, so a
hosted restore still needs such tables in `replaceableTables`.

An empty destination must be reserved for restore: pause destination writers.
Product writes to source tables can continue. Import upload, finalize and abort
requests are serialized by a durable request claim.

Imports hold a **five-minute inactivity lease**, created with the job and renewed
by every upload/finalize request, then every 30 seconds while that request is
working (including verification, R2 transfers and product callbacks). This is a
recovery window, not a total restore limit: the measured 20,000-row round trip
below already takes 171 seconds, and callbacks have no wall-time bound. A fresh
import returns `409 import_running`. Only a validated internal lease refusal,
after authorization and for the actor who owns that import, includes `jobId`
and ISO `abortableAt`. Authorization failures and other actors receive no job or
lease metadata, even if an error carries the same code or fields. The owner
can find its active job with `GET /api/portability/imports` (`{active:status}`
or `{active:null}`), and inspect `GET .../imports/:id`: `abortableAt` and `stale` describe
its lease. The existing authenticated `POST .../imports/:id/abort` (or CLI
`abort --resume ID`) discards stale staging and owned objects. A live request
cannot be aborted through that route. An expired upload/finalize returns
`409 import_lease_expired`; start the restore again.

The next import automatically aborts a stale job through that same cleanup path
before claiming the destination. Applying jobs use the existing owned-object
recovery: product rows publish in one fenced D1 transaction, so an interrupted
pre-commit apply has no product rows to undo; a committed job stays complete,
including after a lost acknowledgement. Cleanup never deletes foreign objects.
Lease bookkeeping is created privately on existing destinations without a product
migration; an older unfinished job receives one five-minute grace period. The
local CLI's `abortAbandoned` remains restricted to a sole operator holding its
checkout lock; hosted callers must use the lease-aware create/status/abort paths.
R2 has no compare-and-swap transaction covering bucket emptiness and writes.
An interrupted applying job can be finalized again; ownership survives restart.
Keep job status until the client acknowledges completion. Abort completed exports
and unfinished imports when no longer needed; completed import copies can be
invalidated by the product's erasure batch.

## HTTP and CLI

`await createPortabilityHandler({db,buckets,policy,appOrigin,basePath,authorize})`
returns an async dispatcher, or null for foreign paths. Default base path is
`/api/portability`. The product's `authorize(request,{operation,jobId})` returns
an actor id or null. Jobs belong to their creating actor. Unsafe methods require
the exact configured Origin. Responses have `Cache-Control: no-store` and errors
are `{error:code}`. Request bodies are bounded; `maxBodyBytes` can lower the bound.
Typed authorization errors retain their HTTP status, directly or through a
bounded, cycle-safe `cause` chain. Codes come from the existing fixed public
vocabulary (for example `403 step_up_required`); unknown codes become
`operation_failed`. Portability diagnostics expose the known code prefix only,
never caller-supplied suffixes. Aggregate error collections are not authority
wrappers. Native diagnostics remain private:
transient D1 availability failures use `503 operation_failed`, transport timeouts
use `504 operation_failed`, and unexpected faults remain `500 operation_failed`.
The hosted CLI aborts a completed export after saving and verifying the local
archive, releasing its snapshots and parts. Interrupted downloads retain their
job for resume.

| Method / relative path | Action |
| --- | --- |
| `POST exports` | Create export. |
| `GET exports/:id` | Status. |
| `POST exports/:id/advance` | Advance with optional expectedPart/maxParts. |
| `GET exports/:id/download` | Stream archive. |
| `POST exports/:id/abort` | Clean up export. |
| `POST imports` | Create with `{confirmed:true,manifest}`. |
| `PUT imports/:id/parts/:index` | Upload part. |
| `POST imports/:id/finalize` | Apply with `{archiveHash,contentHash?,laterJournal?}`. |
| `GET imports` | Active import belonging to this actor, or null. |
| `GET imports/:id` | Status including lease expiry and stale flag. |
| `POST imports/:id/abort` | Clean up unfinished import. |

```sh
node vendor/base/modules/portability/cli.mjs export --origin https://app.example.com --session-file /absolute/session.cookie --out /absolute/archive.jsonl
node vendor/base/modules/portability/cli.mjs import --origin https://app.example.com --session-file /absolute/session.cookie --from /absolute/archive.jsonl
node vendor/base/modules/portability/cli.mjs status --origin https://app.example.com --session-file /absolute/session.cookie --resume JOB_ID
node vendor/base/modules/portability/cli.mjs abort --origin https://app.example.com --session-file /absolute/session.cookie --resume JOB_ID
```

Only HTTPS or HTTP on literal localhost, 127.0.0.1 or [::1] is accepted. Origins
cannot contain URL credentials, path, query or fragment. The small regular session
file contains one cookie; its value is never displayed or copied. Paths must be
absolute. `--base-path` selects another mounted path. Export refuses an existing
output, writes a 0600 `.partial`, verifies every line, syncs, then renames it to
the final name, leaving no second link, so `rer import` accepts the file. New
directories are 0700. A 0600 `.transfer.json` stores the job id and origin.
Use the printed resume command with the same job id. A resumed download
starts at the manifest and re-verifies the stream before promotion. Imports
re-read and verify the file, retrying earlier acknowledged parts harmlessly.

## Direct bindings

The adopting seed supplies Wrangler; the module adds no dependency:

```js
import { getPlatformProxy } from 'wrangler';
import { createPortability, readArchive } from './vendor/base/modules/portability/index.mjs';
import { portabilityPolicy } from './src/portability-policy.mjs';
const proxy = await getPlatformProxy({ remoteBindings: false });
// For reviewed remote use, mark the D1/R2 bindings remote in Wrangler config
// and enable remoteBindings. Credential provisioning stays with the seed.
try {
  const service = await createPortability({ db: proxy.env.DB, buckets: {FILES:proxy.env.FILES}, policy: portabilityPolicy });
  const id = await service.exports.create();
  while ((await service.exports.advance(id,{maxParts:16})).phase === 'building') {}
  for await (const record of readArchive(await service.exports.download(id))) {
    // Write each record to an owner-only file, or upload it to a fresh target.
  }
} finally { await proxy.dispose(); }
```

## Erasure fence

Include `await service.erasureStatements(table,primaryKey)` in the product's own
deletion batch. Keys are objects of primary-key columns; a keyless table uses
`{rowid:integer}`. Tombstones are opaque hashes bound to source identity, table
and canonical key. Journals grow and epochs prevent older source restoration.
For rows deliberately kept with all personal values replaced, include
`await service.redactionStatements()` in that same transaction instead of
permanently tombstoning their retained primary keys. It fences the source's
checkpoint using the private portability state row and advances the epoch.
A destination or trusted later journal with that checkpoint refuses the whole
older archive; a post-redaction archive remains restorable with anonymous rows.
This stricter checkpoint is necessary when preserved identities still appear in
new archives. It does not change offline transfer's need for a trusted later journal.

Archives, separately supplied later journals and destination journals all fence
restore. Commit adopts source identity so subsequent erasures keep matching.

Include `await service.invalidateTransfersStatements()` in that same batch to
drop every transfer snapshot, staging copy and stored part. This does not plan
product erasure or remove product objects; the product handles attachments and
any extra state. Do not retain a previously downloaded archive as erasure proof;
supply the owner's later journal when restoring old offline data.

## Historical measured capacity

An unverified historical local Miniflare D1/R2 report recorded export, restore
and export of 20,000 rows across five tables in 171.169 seconds, with 625 parts at a configured 4 KiB bound and a
1,979,471-byte archive. Restore used one atomic D1 commit. The verification run
can produce fresh measurements; no corresponding historical benchmark receipt
is retained in this repository. These figures do not establish current production
capacity. Real D1 CPU, query, statement and storage limits, object mutation,
destination writers and extra-payload recovery need product-level verification.

## Adopting

Copy exactly these runtime, declaration and schema files byte for byte under the
seed's `vendor/base/` directory. The fixture adoption test parses this list and
executes the copied Worker and CLI. Tests and development fixtures are not copied.

```text
modules/portability/index.mjs
modules/d1-transport/index.mjs
modules/d1-transport/index.d.mts
modules/portability/index.d.mts
modules/portability/lines.mjs
modules/portability/hash.mjs
modules/portability/format.mjs
modules/portability/references.mjs
modules/portability/catalogue.mjs
modules/portability/schema-identity.mjs
modules/portability/schema-legacy.mjs
modules/portability/sqlite-tokens.mjs
modules/portability/bookkeeping.mjs
modules/portability/storage.mjs
modules/portability/copies.mjs
modules/portability/dev-data.mjs
modules/portability/provider-data.mjs
modules/portability/policy-data.mjs
modules/portability/generated.mjs
modules/portability/restore-safety.mjs
modules/portability/bridge.mjs
modules/portability/ledgers.mjs
modules/portability/migration-statements.mjs
modules/portability/sql-text.mjs
modules/portability/backfills.mjs
modules/portability/transient-tables.mjs
modules/portability/rebuilds.mjs
modules/portability/replay-views.mjs
modules/portability/legacy-safety.mjs
modules/portability/export.mjs
modules/portability/import.mjs
modules/portability/import-lease.mjs
modules/portability/import-staging.mjs
modules/portability/import-safety.mjs
modules/portability/payloads.mjs
modules/portability/journal.mjs
modules/portability/http.mjs
modules/portability/http-errors.mjs
modules/portability/http-client.mjs
modules/portability/cli.mjs
modules/portability/cli-options.mjs
modules/portability/schema/portability.sql
```

Apply `schema/portability.sql` as the seed's next numbered migration. Preserve
all existing migrations and their ledger. Wire package.json:

```json
{"scripts":{"export":"node vendor/base/modules/portability/cli.mjs export","import":"node vendor/base/modules/portability/cli.mjs import"}}
```

Before copying, capture the source checkout's actual origin with
`git remote get-url origin` and its full revision with `git rev-parse HEAD`.
Record this component in `edition.json`, replacing `ORIGIN` and `PIN` with those
values and `MODULE_ID` with the component's existing edition identifier. Keep
the real source provenance in the edition's component and source
lock rather than embedding a repository address in the copied module:

```json
{"id":"MODULE_ID","role":"module","source":{"kind":"local","paths":["vendor/base/modules/portability"],"origin":{"repository":"ORIGIN","revision":"PIN","paths":["modules/portability"]}}}
```

Follow the seed's edition-authoring source-lock workflow, then prove the copy:

```sh
node scripts/edition-authoring/cli.mjs lock
node scripts/edition-authoring/cli.mjs check
node scripts/edition-authoring/cli.mjs record-base vendor/base/modules/portability modules/portability PIN
node scripts/edition-authoring/cli.mjs verify-base
```

Add `verify-base` and an integrated export/import/export test to the seed's verify.
Keep the seed's real binding names and authorization in its Worker:

```js
import { createPortabilityHandler } from './vendor/base/modules/portability/index.mjs';
const handler = await createPortabilityHandler({
  db:env.DB, buckets:{FILES:env.FILES}, appOrigin:env.APP_ORIGIN,
  policy:{product:'my-product',buckets:{FILES:{}},secretColumns:{connections:['token']},
    requiredConfiguration:['PROVIDER_KEY'],
    exportRow(table,row){if(table==='connections')row.enabled=0;return row;}},
  authorize:async request=>(await ownerSession(request))?.actorId??null,
});
const response = await handler(request); // null means another route owns it
```

Policy, erasure planning, destination maintenance and UI stay in the product.
Base's default-seed and composed foundation CLI adapters adopt direct local D1
bindings with explicit identity/configuration exclusions. Their CLI journeys
exercise archive/reset/restore/archive equivalence. Remote transfer and deployed
product acceptance remain outside this local adoption.


### Optional Managed data intake

Platform's data download is a stored ZIP with kind `runeditrun-app-data` and
schema 1. It is distinct from an installation archive. The reference adapter
opts in with `localPortability({database, policy, buckets, managedData: true})`.
Existing adapters retain their native archive and legacy JSON readers.

Adapters with their own native archive format can keep their existing `import`
method and add `managedDataImport` from an opted-in `localPortability`
declaration. The CLI selects that method only for ZIP input; all other inputs
continue through the adapter's original reader. This requires the seed's real
native Workers database name, binding and portability policy.

Adapters that already consume Base's native format can import `withManagedDataImport`
from the package's portability entry point and call
`withManagedDataImport(context, declaration, restoreNative)` before their native
reader. The declaration supplies the real `binding`, `buckets`, `policy` or
`policyModule`, and optional `platformMigrations`. The callback receives the
context with a private native archive path for a Managed ZIP, or the original
context for other inputs. Authentication, explicit confirmation, custody and
empty-target checks remain the caller's responsibility. The callback must await
its native restore before returning; staging is deleted on success or failure.
This helper emits Base's native portability format; an adapter with a different
format must provide a callback that adopts that native restore contract.

The intake checks the complete ZIP and manifest, required members, checksums,
bindings and Platform ledger before native restore. Source SQL runs in a private
workerd D1 sandbox. The existing exporter preserves its erasure journal, excludes
identity and secret data, maps migration identities using the same hash matching
as native Platform-ledger archives, and emits a verified native archive. Native
restore still checks emptiness, migration compatibility, erasure and row safety.
No source SQL runs against the destination. The intake accounts every non-internal
source table, index, trigger and view against native schema or a named retirement
in destination migrations, including objects attached to excluded tables. Internal
prefixes are compared literally. A scratch native import preflight checks the
projected archive before native restore can open the destination.

The current intake supports one database and declared buckets, local Workers
transport, stored ZIP members, at most 10,000 entries and statements, a 128 MiB
archive, 64 MiB members, 4 MiB metadata members and 16 MiB of SQL, with each SQL
statement at most 100,000 bytes after binding string literals, with at most 100
parameters of at most 2 MiB each. It refuses compressed or encrypted entries,
unsafe paths, duplicate or unexpected members, missing ledgers, other versions,
container transport, later-journal and legacy-recovery options. Refusals use
constant `managed_data_*` reasons and do not print source values.
