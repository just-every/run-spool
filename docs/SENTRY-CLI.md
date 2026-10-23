# Sentry CLI and build-plugin compatibility (SRC-003)

Spool serves the Sentry API doors that the released `sentry-cli` and the Sentry build plugins call, so an existing release job keeps working when only the Sentry URL, the organization and project slugs and the auth token change. This is partial: see **What is not served yet**.

## Point an existing job at Spool

| Setting | Value |
| --- | --- |
| `SENTRY_URL` | Your Spool address, for example `https://spool.example.com` |
| `SENTRY_AUTH_TOKEN` | A project **deploy** key (Settings → Keys). An ingest key, a read-only agent key, a revoked key and a key of another project store nothing. |
| `SENTRY_PROJECT` | The Spool project ID (its slug). A different project than the key's is refused. |
| `SENTRY_ORG` | Any slug. The organization carries no authority; the deploy key names the project. |

```sh
sentry-cli releases new "$VERSION"
sentry-cli sourcemaps inject ./dist
sentry-cli sourcemaps upload --release "$VERSION" --dist "$DIST" ./dist
sentry-cli releases set-commits "$VERSION" --local
sentry-cli releases finalize "$VERSION"
sentry-cli releases deploys "$VERSION" new -e production
```

The Sentry plugins read the same variables (and take `url`, `org`, `project`, `authToken` options): `@sentry/vite-plugin`, `@sentry/esbuild-plugin`, `@sentry/rollup-plugin` and `@sentry/webpack-plugin` at 11.8.0 run the newer `sentry` CLI, which accepts a plain `http://` Spool address only through these settings.

## What happens to what you upload

* **A release** that the SDK already created (SDK-009) is enriched, never split: it keeps its sequence, first-seen time and first environment, and loses the auto-created label. Repeating `releases new` changes nothing.
* **Finalize** records the first finalization time; a repeat keeps it. **Deploys** (`releases deploys … new`, `deploys new`) are recorded on the release exactly as sent; a repeat of the same environment, name, URL and times is one deploy. They carry no commit range, deadline or notification, so they are separate from REL-001 deployment history.
* **Commits** sent by `releases set-commits` are held once each and pass the TEAM-004 citation parser: `Fixes`, `Resolves` or `Closes` plus a short ID of this project's issue links and resolves it in the first release that includes the commit, with the project's release order protecting older releases. Unknown, other-project and imported citations are logged in the repository link log. Spool lists no connected repository (SRC-002), so `sentry-cli` reads the commits from your git checkout and sends their messages and authors, for `--auto`, `--commit` and `--local` alike. The newer `sentry` CLI's `--auto` and `--commit` ask the server to read commits from a repository and are refused by name; use `--local` or no flag.
* **Source maps** in an artifact bundle are stored under the release, dist and **debug ID** the bundle names (run `sourcemaps inject` first). A map with no debug ID is stored under the URL of the script that points at it (`~/static/app.js`), and a frame without a debug ID resolves through that name. A repeat upload of the same bytes changes nothing; different bytes for the same identity are refused.
* **A refused file** is named with its reason in the client's own output and fails the command; the files that fit are stored. Reasons: `too_large`, `unsupported_map`, `storage_cap`, `identity_mismatch`, `identity_conflict`, `malformed_map`, `debug_id_required`, `unmatched_map`, `release_required`. The same text is in the owner's `GET /api/projects/{project}/sentry-uploads`.
* **Interrupted uploads** resume: chunks staged by a failed run are reused by the next, and a chunk or a bundle whose checksum does not match is refused. A structurally malformed bundle is refused as `malformed_bundle` before any map or release is stored; its staged chunks are discarded, so retry must upload them again. Staged chunks expire after an hour. A successful assembly receipt answers repeats only while it is less than thirty days old, even if no cleanup has run. Neither chunks nor receipts are archived.

## Limits today

Spool stores flat or indexed Source Map V3 maps of at most 1 MiB, 1,000 sources and 10,000 names, without a lifetime artifact count; an owner-set project byte cap limits new uploads. The options endpoint advertises 512 KiB chunks, four chunks per request, a 16 MiB bundle and concurrency four. Indexed section offsets and `sourceRoot` resolve locally. SRC-004's 190 MiB maps, 2 GiB debug files and streaming storage remain gaps; files beyond the bounded storage are refused by name. See [SOURCE-MAPS.md](SOURCE-MAPS.md) for parser bounds and custody.

Before storing files, Spool validates every ZIP entry, including entries not named by the manifest, within a total expanded-data limit of 64 MiB. Structurally valid maps over the stored-map capacity still receive the per-file refusals above while maps that fit are stored.

## What is not served yet

* `debug-files upload` (dSYM, ELF/DWARF, Breakpad, ProGuard/R8, Dart symbols) and the Android Gradle plugin, Xcode build phase, Fastlane `sentry_debug_files_upload` and `sentry_dart_plugin` paths that depend on it: each file is refused by name before any byte is sent, because native symbolication (SDK-002) does not exist. `debug-files bundle-sources` and `check` run locally and need no server.
* Repository-backed commit reading (SRC-002): `releases set-commits --auto/--commit` with a connected repository.
* Every other Sentry endpoint: the answer is `501` naming the method and path.

See `docs/retained-verification/src003/` for the local runs and the exact acceptance rows still owed.
