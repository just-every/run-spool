# SRC-003 retained verification

Recorded 21 October 2026 on a Linux x86_64 cloud container (Node 22.22.0) against the emitted Spool Worker. No GitHub Actions, GitLab CI, macOS tool or provider account was used, and no credential other than throwaway test-local deploy keys. Each client below was the released package, driven with only the Spool URL, organization and project slugs and a project deploy key changed.

## In the repository: `tests/sentry-cli-compat.mjs`

Runs on every push. It uses `@sentry/cli` 3.8.1 and the unmodified `@sentry/node` SDK, `@sentry/vite-plugin`, `@sentry/esbuild-plugin`, `@sentry/rollup-plugin` and `@sentry/webpack-plugin` 11.8.0 (which run the `sentry` 0.45.0 CLI):

* An ingest key, a read-only agent key, a revoked key, another project's deploy key and an unknown key are each refused by `releases new`, `finalize`, `deploys new` and `sourcemaps upload`; no release, map or receipt is stored.
* An SDK-created release is enriched by `releases new`: one release, original sequence, first-seen time and first environment, label removed. `releases finalize` and `releases deploys new` (and `deploys new -r`) are recorded and visible to the owner; repeats change nothing; an unknown release is `Release not found`.
* `releases set-commits` with `--auto`, `--commit` and `--local` registers the commits of a real git history through the TEAM-004 parser: the cited issue of the project resolves in the release, an unknown and another project's citation land in the link log with their reasons, another project's issue is untouched, an older-release event does not regress it and a newer-release event does.
* `sourcemaps inject` and `upload` by debug ID, and by release and dist with no injection, store the map; the Node SDK's real failure from the built app maps to the original source line and function; a repeat upload stores nothing new; a map for a different dist maps nothing.
* A map over the stored-map limit fails the client command with the file and reason in its output while the map that fits is stored; the owner sees the same reason.
* A twelve-map, three-megabyte upload crosses several chunks and requests; a proxy drops the second chunk request, the first run fails and stores nothing, the restart completes; the twenty-first map of a project is refused as `storage_cap`; a chunk named by the wrong checksum and an assembly with the wrong checksum store nothing.
* `debug-files upload` of a genuine ELF/DWARF file (compiled from checked-in C) is refused by name with no byte uploaded; `debug-files check` and `bundle-sources` work locally; `send-event` creates an issue; `projects list`, `organizations list` and other unserved routes answer `501` naming the route.
* The new release and deploy tables archive and restore with their original identity and no active grants; staging and receipts are not archived; project erasure counts and removes all four tables.
* Vite, esbuild, Rollup and webpack plugin builds each upload their map, register and finalize one release, and the built app's failure maps to the original source.

## Local runs outside the repository test

These are too heavy for every push or need packages that install at test time. They are single local runs, not repeated, not in CI, not production sized.

| Client (version) | Result against Spool |
| --- | --- |
| `@sentry/nextjs` 11.8.0 `withSentryConfig`, Next.js 16.4.2, webpack build, three consecutive releases of a tiny App Router app | Each release stored 6 maps (18 of the project's 20-map lifetime cap, so a fourth release would meet `storage_cap`). Each release also had 4 server and edge maps refused as `unsupported_map` (more than 100 sources) and the plugin logged "Artifact bundle assembly failed". Not production sized: a real app has far more chunks and larger maps. |
| Same, Turbopack build | 37 maps uploaded: 2 stored, 35 refused by name: 34 `unsupported_map` (indexed maps) and 1 `too_large`. The plugin logged "Artifact bundle assembly failed". |
| Fastlane 2.241.1 with `fastlane-plugin-sentry` 2.8.0 (bundled `sentry-cli` 3.8.0) | `sentry_create_release`, `sentry_upload_sourcemap` (release and dist, no injection), `sentry_finalize_release` and `sentry_create_deploy` succeeded; the owner saw one finalized release with one deploy. `sentry_debug_files_upload` failed ("Error while calling Sentry CLI") because Spool refused the file by name. |
| Expo 58.0.16 (`expo export --platform android --source-maps`), React Native 0.88.0, `@sentry/react-native` 8.31.0 `sentry-expo-upload-sourcemaps` | A 2.8 MB Hermes bundle and a 7.1 MB map exported. The upload failed with the map refused as `too_large`; nothing stored. |
| `sentry` 0.45.0 CLI (used by the 11.8.0 plugins) | `release create`, `finalize`, `deploy`, `sourcemap inject` and `upload` and `release set-commits --local` succeed. `set-commits --auto` fails ("No repository integrations configured") and `--commit` is refused with `501` naming SRC-002. |

## Acceptance still owed

SRC-003 stays **partial**. Not done, and not claimed:

* The full GitHub Actions **and** GitLab CI matrix for every command and integration.
* **Android Gradle plugin** (no Android SDK here), **Xcode build-phase script** (macOS only) and **`sentry_dart_plugin`** (no Dart SDK).
* **`debug-files upload`** for dSYM, ELF/DWARF, Breakpad, ProGuard/R8 and Dart symbols, and Fastlane `sentry_debug_files_upload`: refused by name until SDK-002 symbolication exists. No genuine Breakpad, ProGuard/R8, dSYM or Dart symbol fixture is checked in.
* **Three consecutive production-sized Next.js and React Native Hermes releases** with no refusal for artifact count or a map within SRC-004's size: today the stored-map limits (20 maps, 256 KiB, 100 sources, flat maps only) refuse real builds file by file.
* **`set-commits --auto` and `--commit` through a connected repository** and the newer `sentry` CLI's `--auto` and `--commit`: need SRC-002. Real GitHub PR and GitLab MR receipts are SRC-002's.
* Older plugin releases that call `@sentry/cli` 2.x, and React Native/Expo through the Xcode and Gradle scripts, were not run.
* The interactive owner screens were not changed. The release details already show the new fields as JSON; no browser check of them was made.
