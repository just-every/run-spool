# Source maps in Spool

Spool keeps source maps private under an exact project, release, build/dist and debug ID. Release/dist URL names such as `~/static/app.js` continue to resolve without an injected ID. Nothing fetches a source URL.

## Stored capacity

There is no lifetime project or release map count. The project owner can set an optional `artifact_storage_cap` in stored UTF-8 bytes in Releases → source-map setup, or through the owner-only `GET`/`PUT /api/projects/{project}/artifact-storage` door. PUT takes the current `revision` and a nonnegative byte cap or `null` to remove the cap. The setting change is audited. A stale revision conflicts. An unset cap causes no byte-cap refusal. Lowering a cap preserves existing data; only new map inserts are refused. Identical uploads remain idempotent even when the cap is full. The check is transactional, so concurrent uploads cannot overspend it.

The cap is carried by private archive/restore and removed by project or installation-owner erasure. A restore preserves a cap below the archived usage: the cap governs future uploads, rather than discarding archived maps. Per-file cap failures include the file name, configured cap and current usage in the Spool CLI, Sentry assemble reply, and stored-map/upload-failure details in the release source-map section. The CLI returns nonzero and leaves local output unchanged when any upload fails.

## Bounded formats and storage ceiling

Stored map JSON is at most **1 MiB (1,048,576 bytes)**, across flat V3 or inline indexed V3 sections. The parser allows at most 1,000 total sources, 10,000 names, 512 KiB of encoded mappings, 20,000 generated lines and 50,000 mapping segments; coordinates are nonnegative safe integers at most 10,000,000. Indexed maps allow at most 128 sections and nesting depth four. Section offsets are ordered and bound generated lines before decoding. URL sections are refused; Spool never follows them. Embedded sources, `sourceRoot`, `ignoreList` and `x_google_ignoreList` stay with the private map. Lookup applies section line/first-line-column offsets and resolves source roots. Ignore-list frame classification remains a GROUP-001 gap.

The byte ceiling leaves room under D1's row limit for identity and metadata, bounds source parsing, and keeps lookup within request memory. Local public-door checks exercise maps above the old 256 KiB bound, a map at this ceiling and the refusal above it. This is a bounded D1 implementation, not a hosted production capacity qualification. The prepared-map browser picker still offers its existing flat 256 KiB path; use the CLI for indexed or larger maps.

Sentry chunk options advertise **512 KiB chunks**, four chunks/request, concurrency four, and a **16 MiB assembled bundle**. A bundle can contain multiple maps, each subject to the 1 MiB stored-map limit. Staged chunks total at most 64 MiB/project and expire after one hour; assembly receipts expire after thirty days. ZIP expanded bytes are bounded to 64 MiB. These bundles assemble in memory. They do not provide streamed storage of a 190 MiB map or 2 GiB debug file.

## Retention and remaining boundaries

Manual retention preserves maps referenced by retained events in the same release/build. Use-based artifact expiry for a full retention window after upload or last use is not implemented. Native symbols (dSYM, ELF/DWARF, PDB, Breakpad, ProGuard, Dart and Hermes), streamed chunk assembly, USD storage pricing, source fetching, production Next.js App Router and React Native Hermes builds, and 190 MiB maps/2 GiB debug files remain SRC-004 gaps.
