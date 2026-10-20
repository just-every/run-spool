<p align="center">
  <a href="https://run-spool.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.webp">
      <img src=".github/assets/banner-light.webp" width="100%" alt="Spool: See exactly what broke. 100% free, open source alternative to Sentry, Bugsnag and Rollbar.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://run-spool.com">run-spool.com</a> · <a href="https://justevery.com">Part of Just Every</a> · <a href="LICENSE">MIT licensed</a></p>

<p align="center">
  <a href="https://justevery.com/#vol-spool"><img src=".github/assets/media/preview.gif" width="800" alt="Spool: a storefront error arrives, its stack trace maps to src/account.ts line 42 and the evidence packet is ready"></a>
</p>
<p align="center"><a href="https://justevery.com/#vol-spool"><b>Watch the full demo</b></a> · 51 seconds</p>

<p align="center">
  <img src=".github/assets/media/flow.webp" width="800" alt="1 Caught, 2 Mapped, 3 Ready: the TypeError arrives as a new issue, its stack frame maps to src/account.ts:42:25, and the evidence packet is ready to download">
</p>

<p align="center">
  <img src=".github/assets/media/screen-1.webp" width="800" alt="Spool's issue page for TypeError: Cannot read properties of undefined (reading 'city'): seven occurrences, the stack trace mapped to src/account.ts:42:25, and the evidence packet"><br>
  <sub>Each error traced to the exact line in your original source.</sub>
</p>

<p align="center">
  <img src=".github/assets/media/screen-2.webp" width="800" alt="Spool's Issues list: the TypeError marked Regressed in r43 above two new issues, with release, status, occurrences and last received"><br>
  <sub>A fixed error that comes back is flagged as a regression in its release.</sub>
</p>

# Spool · See exactly what broke

Spool catches JavaScript, Python and Go errors, groups repeats into issues, and maps JavaScript stacks back to your original source. Download an evidence packet for a fix, give an agent evidence access and inert grouping-proposal submission to one project, and see when a resolved error comes back in a later release. One owner can keep several projects separate, export private evidence and restore it into a fresh copy.

Public source: [just-every/run-spool](https://github.com/just-every/run-spool). The latest tagged Spool release is [v0.6.0](https://github.com/just-every/run-spool/tree/v0.6.0). The clone instructions below use `main`, which may be ahead of that tag; the tagged release has its own instructions. See the [changelog](CHANGELOG.md). Licensed under the [MIT License](LICENSE).

Run Spool on your computer without a Cloudflare account or mail provider, or deploy it to your own Cloudflare Worker and D1 database. The [first-release jobs and verification requirements](ACCEPTANCE.md) describe what to expect.

## Run it on your computer

Start with **Node 22 or later** and **git**, on macOS, Linux or Windows with WSL2. If Node is missing or older, install it from [nodejs.org](https://nodejs.org/en/download), reopen your terminal and check `node --version` before continuing, or skip that and run `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-spool`, which brings its own Node. On WSL2, install Node and git inside WSL2. Node 22 or later must already be on PATH to start rer through npx; rer then supplies this project's pinned Node 22.20.0 and pnpm 10.12.4. You do not need pnpm on PATH. One line, as on the [Run page](https://run-spool.com/run), installs rer, clones Spool and starts it:

```sh
npx -y @runeditrun/rer dev just-every/run-spool
```

To start it again later, run `cd run-spool && rer dev`. To run the tagged release instead, use `git clone --branch v0.6.0 https://github.com/just-every/run-spool.git spool && cd spool && rer dev` in place of that line. Its dependencies and instructions are those shipped with that tag.

`rer dev` installs everything, prepares a local owner and prints a link that opens Spool signed in. First start uses `owner@run-spool.test` for the `run-spool` folder above, without asking for an email, even when input is piped. Another folder name produces `owner@<sanitized-folder-name>.test`; existing setup keeps its owner.

To choose your own email before first start, run `npx -y @runeditrun/rer setup just-every/run-spool` instead, then `cd run-spool && rer dev`. Explicit setup asks for missing required answers in an interactive terminal. With non-TTY input, put JSON such as `{"OWNER_EMAIL":"you@example.com"}` in `.rer/local/setup-answers.json`, an ignored private file with mode `0600`, then run `rer setup --answers .rer/local/setup-answers.json --non-interactive` from the Spool checkout. The answers path must be relative and contained inside that checkout; absolute paths, traversal and symlinks are refused. Piping an email alone is not a setup answer. Saved answers are reused. To replace the temporary dev owner's address later, stop dev first and supply `OWNER_EMAIL` through that file. Keep addresses and secrets out of shell arguments. See [installation](docs/install.md) for the file procedure.

Setup prepares private settings and the database, claims or preserves the owner, opens the local owner without email and stops its temporary app; run `rer dev` afterwards. It creates no sample project and sends no real email. For older state, follow [OPERATIONS.md](OPERATIONS.md#existing-installation-recovery).

`rer dev` opens signed in as the owner. Open the private `RER_OPEN` link printed on this computer; its `#rer-dev=` fragment carries this checkout's owner gate. Keep the link and gate private. Local development reads **Spool Dev**; `rer demo` reads **Spool Demo** and adds sample data in disposable state. Mail is silently suppressed in dev and demo; no mailbox viewer is needed.

With rer dev v2 (using the rer version pinned in [package.json](package.json)), an ingest key created in dev works directly from your app against local Spool, and a deploy key works from your local build, without the owner gate. Allow your browser app's exact origin in Capture. Read-only dev agent keys still need the gate: privately extract the `rer-dev` fragment value as `SPOOL_DEV_KEY` for the local agent CLI, as shown in [the agent guide](docs/WITH-YOUR-AGENT.md#local-agent-access). Never give the gate to a browser app. Every dev-minted key is refused by deployed Spool; create fresh keys there. Private archives exclude all project grants.

A fresh installation opens `/setup`. Create the first project, copy its once-shown ingest key, add the SDK with the shown install line and init, use **Send test error** to check ingestion from Spool itself, then choose **Continue to workbench**. Replace a lost key in Settings. To restore existing evidence instead, choose **Restore a private archive** before creating a project. Register the app's release/build before sending its errors; the setup test registers the release/build shown on that screen.

Stop dev with `rer dev --stop` (or Ctrl+C in the foreground) before deploy, verify, reset or transfer. Your owner, projects and evidence stay on this computer for the next start. [RUN-LOCALLY.md](RUN-LOCALLY.md) describes preview, idle timeout and server capacity. `rer describe` lists supported maintenance commands and flags.

Export before reset and import only into an empty destination. Export includes private maps and browser-origin policy but excludes sign-in sessions, project keys, outbox and temporary state. Run setup if the destination has no owner and create new keys after restoring. Browser restore is available from `/setup` before the first project and Settings thereafter. For CLI import of a browser download, first run `chmod 600 /path/to/spool-private-archive.jsonl`; see [the transfer procedure](OPERATIONS.md#data-movement-and-retention). Reset removes only its displayed local inventory and preserves source, exports and deployment records.

## Upgrade from 0.5.0

Back up first: export a private archive (Settings → **Download private archive**, or stop dev and run `rer export --output exports/spool.rer`). In a checkout of `main`, run `git pull` and then `rer dev`; in a checkout of an earlier tag, run `git fetch --tags && git checkout v0.6.0` and then `rer dev`. Hosted installations update with `rer deploy` from the original deploying checkout, retaining its private settings and deployment receipt. This release adds three migrations, `0054` through `0056` (56 in total), which those commands apply; existing projects, evidence, triage states, grouping rules, inbound filters, alert rules and project keys are preserved. Keep the existing database; no reset or restore is needed. From 0.5.0 the same steps also apply `0049` through `0053`, from 0.4.0 the same, from 0.3.1 also `0044` through `0048`, from 0.3.0 also `0042` and `0043`, from 0.2.0 `0037` through `0041`, and from 0.1.0 `0020` through `0036`. An archive written by 0.5.1 or earlier also restores into a fresh 0.6.0 installation. See the [release record](RELEASE.json) and [changelog](CHANGELOG.md).

## Managed hosting

Spool uses the rer version pinned in [package.json](package.json) and supports RER Managed mail for sign-in links and email alerts. Managed Configure supplies and hides the mail settings: no mail-provider account or copied API key is needed. Free and Assisted self hosting keep their existing provider choices and sender setup; see [the hosting guide](docs/HOSTED.md#managed-mail).

## Run it on your Cloudflare account

Follow [the hosting guide](docs/HOSTED.md) to configure your account and email sender. Stop local dev with `rer dev --stop`, then run `rer deploy`. Open `/sign-in` on the printed hosted address and request an email link. If you cannot receive mail, `rer signin --env-file .rer/deploy/production.env --environment production` prints a private, one-use owner link using the hosting guide's private settings file, the same Cloudflare credentials and original deploying checkout; it expires within 15 minutes.

To remove it, export anything you need and run `rer deploy --remove --yes` from the original deploying checkout, retaining its private deployment record and using the same account credentials. The default environment is `production`; add `--environment <name>` for another environment. Removal deletes the Worker and its database. The hosting guide also covers updates and restoring archives. `rer deploy --dry-run` builds and validates the package without deploying; with the Cloudflare credentials it also reads the target's secret bindings, and without them it stops with exit 3 after naming every input a real deploy still needs.

## Capture protocol

Spool's own SDK, [`@just-every/spool`](packages/sdk/README.md), is the way to send errors. Install it and initialise it once with the project's endpoint and ingest key:

```sh
npm install @just-every/spool
```

As of 2026-10-15, this installs SDK 0.1.0, the published npm version. SDK 0.2.0 remains owner-held and unpublished. Ordinary error capture and map upload work with 0.1.0; exposure measurement (`client`, `anonymousClient()` and `exposure()`) and the Vite/Rollup upload-count message require 0.2.0. The Spool app release does not publish or upgrade the SDK. See the [SDK release notes](packages/sdk/CHANGELOG.md).

```js
import { init } from '@just-every/spool';
init({ endpoint: 'https://spool.example.com', project: 'web-app', ingestKey: 'YOUR_INGEST_KEY',
  release: 'web@1.4.0', build: 'b1907' });
```

The browser SDK captures errors and unhandled rejections and can attach the last 20 explicit, scrubbed breadcrumbs. Use `@just-every/spool/node` for Node and `@just-every/spool/worker` for Cloudflare Workers. The package also includes `npx spool-sourcemaps` and the Rollup/Vite plugin at `@just-every/spool/vite` for uploading maps that match your build.

Setup, Capture and Settings show the install line and init for your project. Allow your app's browser origin before connecting it; **Send test error** runs inside Spool and does not check that external origin. Follow [the capture guide](docs/capture.md) for browser permissions, local key scopes, release registration and map upload. Pages without a bundler can use `/errors-capture.js`.

### Already using Sentry? Point your DSN here

Each project can issue a Sentry DSN for supported JavaScript, Python and Go exception reports. Spool scrubs the selected error fields and discards unsupported telemetry. [Switching from Sentry](docs/SENTRY-SWITCHING.md) covers supported intake, map tooling and the optional organization-export importer. The importer has been qualified with synthetic fixtures; a real organization export still needs reconciliation. This does not establish feature parity or a completed migration.

## Operating limits and privacy

Spool is intended for bounded error evidence. Each project retains at most 10,000 occurrences and admits at most 120 new occurrences per minute; recorded rejections can reduce the remaining admission budget. The issue list and its filters cover the latest 100 groups, and packets include the latest 10 occurrences. Maps are private uploads, limited to 20 flat V3 maps of 256 KiB per project; Spool never fetches source URLs. Ingest requests are limited to 32 KiB, 30 frames and 20 breadcrumbs.

The SDK and server scrub common emails, tokens and passwords, but free text can contain personal data those patterns do not recognize. Inspect event and packet previews. There is no durable offline queue, automatic retry or guaranteed unload flush; errors lost before reaching Spool are unknown. Firefox and Safari stack parsing is implemented but has not been tested in those browsers. See [supported languages](docs/SUPPORTED-LANGUAGES.md) for exact Python and Go support and symbolication limits.

Private archives include source maps and exclude sign-in sessions and project credentials. Browser restore accepts up to 16 MiB; use the streaming CLI for larger archives. Older native v1 and v2 archives remain supported. Retention and project erasure cannot remove copies you already exported elsewhere. See [data movement and retention](OPERATIONS.md#data-movement-and-retention) and [project erasure](docs/PROJECT-ERASURE.md).

Optional project alerts cover new issues, regressions in later releases and spikes in received events. Add, edit and test email destinations from **Alerts → Rules**, then select one in a rule ([steps](docs/ALERT-WEBHOOKS.md#manage-email-destinations)). Email alerts require a configured provider; signed webhooks require a separately installed service that enforces destination restrictions. Provider submission does not prove recipient delivery. Local mail is suppressed. See [alerts](OPERATIONS.md#per-project-alerts) and [webhook setup](docs/ALERT-WEBHOOKS.md).

The [triage guide](docs/triage.md) explains issue links, mapped stacks and first capture. You can record repair checks and the release that shipped a fix; Spool reports recurrence or explains why the available capture and exercise evidence is inconclusive. It does not infer that a fix worked just because no new error arrived.

## Develop and verify

After `rer install`, run `npm run test:setup --` once to install this checkout's Chromium browser for verification; repeat after changing the Playwright version. Stop dev, then run `rer verify` to build, typecheck and exercise the application, sign-in, capture, maps, triage and restore flows. These commands run locally and never deploy.

[ACCEPTANCE.md](ACCEPTANCE.md) describes the verification requirements and remaining limits. [AGENTS.md](AGENTS.md) and [OPERATIONS.md](OPERATIONS.md) cover source maintenance and recovery. A passing local check does not establish mail delivery, a live provider integration or large-instance economics.
