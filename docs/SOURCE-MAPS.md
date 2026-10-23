# Source maps in Spool

Spool keeps source maps private under an exact project, release, build/dist and debug ID. Release/dist URL names such as `~/static/app.js` continue to resolve without an injected ID. Nothing fetches a source URL.

## Stored capacity

There is no lifetime project or release map count. The project owner can set an optional `artifact_storage_cap` in stored UTF-8 bytes in Releases → source-map setup, or through the owner-only `GET`/`PUT /api/projects/{project}/artifact-storage` door. PUT takes the current `revision` and a nonnegative byte cap or `null` to remove the cap. The setting change is audited. A stale revision conflicts. An unset cap causes no byte-cap refusal. Lowering a cap preserves existing data; only new map inserts are refused. Identical uploads remain idempotent even when the cap is full. The check is transactional, so concurrent uploads cannot overspend it.

The cap is carried by private archive/restore and removed by project or installation-owner erasure. A restore preserves a cap below the archived usage: the cap governs future uploads, rather than discarding archived maps. Per-file cap failures include the file name, configured cap and current usage in the Spool CLI, Sentry assemble reply, and stored-map/upload-failure details in the release source-map section. The CLI returns nonzero and leaves local output unchanged when any upload fails.

## Bounded formats and storage ceiling

Stored map JSON is at most **1 MiB (1,048,576 bytes)**, across flat V3 or inline indexed V3 sections. The parser allows at most 1,000 total sources, 10,000 names, 512 KiB of encoded mappings, 20,000 generated lines and 50,000 mapping segments; coordinates are nonnegative safe integers at most 10,000,000. For expanded-capacity or indexed maps, source paths, source roots and the optional file name are at most 2,048 UTF-16 code units each, bounding root expansion across sources. Flat maps within the previous 256 KiB/100-source parser bounds retain their accepted path grammar, preserving stored-map upgrade and restore compatibility. Indexed maps allow at most 128 sections and nesting depth four. Section offsets are ordered and bound generated lines before decoding. URL sections are refused; Spool never follows them. Embedded sources, `sourceRoot`, `ignoreList` and `x_google_ignoreList` stay with the private map. Lookup applies section line/first-line-column offsets and resolves source roots. Ignore-list frame classification remains a GROUP-001 gap. Optional function-name enrichment parses source files only up to 131,072 UTF-16 code units; larger embedded sources still map file/line/column and keep the reported function name.

Lookup processes frames sequentially and retains at most eight map payloads and function-scope indexes per operation. The byte ceiling leaves room under D1's row limit for identity and metadata, bounds source parsing, and keeps lookup within request memory. Local public-door checks exercise maps above the old 256 KiB bound, a map at this ceiling and the refusal above it. This is a bounded D1 implementation, not a hosted production capacity qualification. The prepared-map browser picker still offers its existing flat 256 KiB path; use the CLI for indexed or larger maps.

Sentry chunk options advertise **512 KiB chunks**, four chunks/request, concurrency four, and a **16 MiB assembled bundle**. A bundle can contain multiple maps, each subject to the 1 MiB stored-map limit. Staged chunks total at most 64 MiB/project and expire after one hour; assembly receipts expire after thirty days. ZIP expanded bytes are bounded to 64 MiB. These bundles assemble in memory. They do not provide streamed storage of a 190 MiB map or 2 GiB debug file.

## Retention and remaining boundaries

Manual retention preserves maps referenced by retained events in the same release/build. Use-based artifact expiry for a full retention window after upload or last use is not implemented. Native symbols (dSYM, ELF/DWARF, PDB, Breakpad, ProGuard, Dart and Hermes), streamed chunk assembly, USD storage pricing, source fetching, production Next.js App Router and React Native Hermes builds, and 190 MiB maps/2 GiB debug files remain SRC-004 gaps.

## Spool bundler plugins and required sets (SRC-001)

The next packed SDK includes `@just-every/spool/webpack` and `@just-every/spool/esbuild` alongside the Vite/Rollup plugin. No SDK version is bumped by this change. An owner publication is needed before using these additions from the registry.

All four plugins share the CLI's debug-ID injection and upload implementation. They derive map names from every emitted JavaScript chunk and verify the server's SHA-256 against canonical transported map JSON. `requiredMaps` adds names that must also be present. A missing name or checksum mismatch fails the build and names the file. Vite/Rollup reject before writing output; webpack stamps before content hashing and uploads final hashed map bytes before emit, rejecting failed asset processing; esbuild holds output files in memory until upload and verification succeed, then honors the caller's original `write` option. Existing output from an earlier build is not a successful new deployment.

```js
// webpack.config.mjs
import { SpoolSourceMapsPlugin } from '@just-every/spool/webpack';
const spool = { endpoint: process.env.SPOOL_URL, project: process.env.SPOOL_PROJECT,
  release: process.env.SPOOL_RELEASE, build: process.env.SPOOL_BUILD,
  keyEnv: 'SPOOL_DEPLOY_KEY', requiredMaps: ['app.js.map'] };
export default { mode: 'production', entry: './src/index.js',
  output: { filename: 'app.js' }, devtool: 'source-map',
  plugins: [new SpoolSourceMapsPlugin(spool)] };
```

```js
// build-esbuild.mjs
import { build } from 'esbuild';
import { spoolSourceMaps } from '@just-every/spool/esbuild';
await build({ entryPoints: ['src/index.js'], outfile: 'dist/app.js',
  bundle: true, minify: true, sourcemap: true,
  plugins: [spoolSourceMaps({ endpoint: process.env.SPOOL_URL,
    project: process.env.SPOOL_PROJECT, release: process.env.SPOOL_RELEASE,
    build: process.env.SPOOL_BUILD, keyEnv: 'SPOOL_DEPLOY_KEY',
    requiredMaps: ['app.js.map'] })] });
```

For Vite, add `spoolSourceMaps` from `@just-every/spool/vite` last in `plugins` and set `build.sourcemap: true`. For Rollup, import the same factory from `@just-every/spool/rollup`, set `output.sourcemap: true` and add it to `plugins`. Both take the same connection and `requiredMaps` options above. Keep the deploy key in a CI secret, never the application bundle.

The CLI takes repeatable `--required-map NAME` flags, for example `spool-sourcemaps --endpoint "$SPOOL_URL" --project "$SPOOL_PROJECT" --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" --key-env SPOOL_DEPLOY_KEY --required-map app.js.map dist/app.js`. CLI map names use bundle basenames plus `.map`; use plugins for emitted chunks in nested paths. A declaration contains at most 2,000 map names and 256 KiB of serialized JSON, so every admitted set fits private archive rows. Map names must be unique within a build; a collision fails rather than overwriting an identity.

Registration records an immutable map-name set in `source_map_builds`. Native release registration accepts `requiredArtifacts: ['app.js.map']`; uploads carry `file` and optional `checksum`; the deploy-authorized `POST /api/projects/{project}/artifact-builds/verify` takes `release` and `build`. It returns 409 with every missing name until complete. The release source-map section shows complete/incomplete and missing names. Up to 100 recent declared builds are displayed. The prepared-map picker supplies a debug ID without a declared file name; use the CLI or plugin for required-set completion. A late upload through the CLI or plugin must declare the same original set, including already stored names. It completes that set without changing earlier debug IDs/checksums. Build declarations and map names travel in private archives and are removed by project/owner erasure.

## GitHub Actions example

Set project/release/build and origin variables, plus the project deploy key secret. In your application, define `build:vite`, `build:rollup`, `build:webpack` and `build:esbuild` scripts using the configurations above; each plugin build uploads and verifies before returning. `build:cli` builds external maps, followed by the CLI step. Replace the deployment command with your reviewed deployment script; it only runs after successful upload.

```yaml
name: Publish application maps
on: [push]
jobs:
  maps:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        bundler: [cli, vite, rollup, webpack, esbuild]
    env:
      SPOOL_URL: ${{ vars.SPOOL_URL }}
      SPOOL_PROJECT: ${{ vars.SPOOL_PROJECT }}
      SPOOL_RELEASE: ${{ github.sha }}
      SPOOL_BUILD: ${{ matrix.bundler }}
      SPOOL_DEPLOY_KEY: ${{ secrets.SPOOL_DEPLOY_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build:${{ matrix.bundler }}
      - if: matrix.bundler == 'cli'
        run: npx spool-sourcemaps --endpoint "$SPOOL_URL" --project "$SPOOL_PROJECT" --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" --key-env SPOOL_DEPLOY_KEY --required-map app.js.map dist/app.js
      - run: npm run deploy:reviewed
```

## GitLab CI example

Configure the same variables and a masked/protected deploy-key variable in GitLab. The `&&` chain prevents deployment on a refused map or incomplete set. Plugin scripts perform their own upload.

```yaml
stages: [build]
map-build:
  stage: build
  image: node:22
  parallel:
    matrix:
      - BUNDLER: [cli, vite, rollup, webpack, esbuild]
  variables:
    SPOOL_RELEASE: $CI_COMMIT_SHA
    SPOOL_BUILD: $BUNDLER
  script:
    - npm ci
    - npm run build:$BUNDLER
    - if [ "$BUNDLER" = cli ]; then npx spool-sourcemaps --endpoint "$SPOOL_URL" --project "$SPOOL_PROJECT" --release "$SPOOL_RELEASE" --build "$SPOOL_BUILD" --key-env SPOOL_DEPLOY_KEY --required-map app.js.map dist/app.js; fi
    - npm run deploy:reviewed
```

These YAML examples are syntax-checked and the four bundler builds run locally against Spool. They have not run on real GitHub Actions or GitLab CI application runners this round. Access/retention checks before deployment beyond exact deploy authority and the declared artifact set, private source bundles/native symbols, Next.js/Hermes and SRC-003's full unmodified CLI/plugin matrix remain gaps.

## RELEASE-ROUND DEBT

`packages/sdk` changed without a version bump or registry publication. Was: Vite/Rollup plus a bounded twenty-map Spool upload CLI, with webpack/esbuild requiring a separate CLI step and no required-set/checksum gate. Now: the next packed SDK provides four plugins, a byte-bounded CLI without a lifetime count, declared required sets, named incomplete builds and stored-checksum verification. The public prepared-map picker retains its existing flat/256 KiB limit. Release files, tags, package versions and the Release SDK workflow are unchanged.
