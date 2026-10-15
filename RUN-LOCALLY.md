# Run it locally

Use Node 22 or later, git and public rer (`npm install -g @runeditrun/rer`).
rer supplies Node 22.20.0 and pnpm 10.12.4 for this checkout. From a
runnable edition's root, install locked dependencies, prepare its local owner,
then start development:

```sh
rer install
rer setup
rer dev
```

Commands that run project work select the exact Node version declared by the
project. They use an exact matching installed runtime or a checksum-verified
copy cached at `~/.rer/node/node-vVERSION-PLATFORM-ARCH/`; when needed on
supported platforms, the runner retrieves the official Node release and checks
its SHA-256 against `SHASUMS256.txt`. It does not change global Node installations.
Set `RER_NODE_AUTO=0` to disable automatic selection. If selection is disabled
or acquisition fails, the command reports a repair invocation in this form:
`npm exec --yes --package=node@VERSION -- node SCRIPT VERB --cwd PROJECT`.
Help, check, describe, doctor and stop do not select or acquire Node.
A runtime that has just verified also drops its stale `.quarantine-` copies and
Node's unused `include/` headers, which saves about 250 MB per Node release;
`doctor` lists what it could not remove. `doctor` also warns, without failing,
about Node releases, workerd versions and pnpm pins that checkouts running on
this computer set differently (each distinct pin keeps its own copy), and about
a checkout on another volume than your home folder, where pnpm cannot clone
packages from its store.

`rer dev` opens signed in as the owner. Open the private `RER_OPEN` link printed on this computer; its fragment carries the checkout key, which must never be shared. Local development reads **Spool Dev**; `rer demo` reads **Spool Demo** and adds sample data in disposable state. Mail is silently suppressed in dev and demo. There is no mail viewer or top bar. Stop with `rer dev --stop` or `rer demo --stop` before reset or data transfer. Project keys created with a dev persona require the private dev gate; use `rer dev --login` and its one-click owner link for native project credentials.

The saved local port is used; a first setup saves the first free port from 8787. Explicit ports are decimal
integers from 1 through 65535 and must be free; a busy requested port fails
instead of silently moving. Only `127.0.0.1`, `localhost` and `::1` are allowed.
Dev applies the selected host and port to both the listener and runtime bindings;
readiness is bounded and failure stops the owned processes. Sign-in and dev-key
cookies are named for the port, so checkouts open side by side on different
ports in one browser each keep their own sign-in.

A first `setup` without `--port` saves the first free port from 8787 and prints
it in one line; it never saves a port another process listens on, on any
address. To move a checkout whose saved port is held by another checkout (or
by nothing), run `rer setup --port N` in it: only the saved
port changes, its data is kept, no reset is needed, and setup prints the old
and new port. A refusal for a busy port names the process or checkout that
holds it and gives that exact command with a free port.

Heavy work (install, setup, build, verify) waits in a machine-wide gate in
`~/.rer/jobs` when 3 jobs are running, the 1-minute load is above 36 or
available memory is at or below 2 GiB. Available memory is what the OS can
reclaim (macOS: free, inactive, speculative and purgeable pages from
`vm_stat`; Linux: `MemAvailable`), not the small "free" counter. A waiting
message gives the queue position, the jobs ahead with their checkout paths and
the available memory against the floor. Change the floor with
`RER_JOBS_MIN_FREE_MEMORY_BYTES` (bytes; 0 turns it off). `dev` and `preview`
never wait behind other checkouts' jobs; they start unless available memory is
below their own floor, described next.

Missing non-interactive setup answers exit 3 and name the manifest fields.
Read `rer-setup.json` and pass a private, mode-0600 JSON object keyed by those
names using `rer setup --answers PATH --non-interactive`,
for example `{"OWNER_EMAIL":"owner@example.com"}`. Secret values stay in
private inputs and never go in command arguments. A setup rerun with the saved
owner and origin preserves existing owner/data and exact private settings.
Conflicting saved identity or origin reports an actionable recovery path.
Review reset's exact removal inventory before confirmation; export domain data
first if it should be restored, and import only into an empty destination.

Queue waits report immediately with a reason and numeric one-based position,
then refresh about every 15 seconds while waiting. From the runnable project
root, inspect the live queue with
`node scripts/base-cli/modules/job-queue/cli.mjs status`.

For the real owner mailbox, `setup` can prompt instead of receiving
`--owner-email` on the command line. Setup builds the app, applies local
migrations, prepares the first owner, requests an ordinary sign-in message and
stops its temporary app before it exits. Existing owner data and private
settings are preserved on a repeated setup.

`rer dev` opens signed in as the owner. Open the private `RER_OPEN` link printed on this computer; its fragment carries the checkout key, which must never be shared. Local development reads **Spool Dev**; `rer demo` reads **Spool Demo** and adds sample data in disposable state. Mail is silently suppressed in dev and demo. There is no mail viewer or top bar. Stop with `rer dev --stop` or `rer demo --stop` before reset or data transfer. Project keys created with a dev persona require the private dev gate; use `rer dev --login` and its one-click owner link for native project credentials.

Dev and preview are managed foreground servers. The first invocation stays
active while serving. Use `rer dev --stop` or
`rer preview --stop` to stop them; `--idle-timeout SECONDS`
sets inactivity cleanup. Compatible repeated starts reuse the registered
server, print readiness and exit. Preview serves fixed production output; dev
serves live source edits.
Both retain the same owner and `.wrangler/state`.

Both also run the project's Cron Triggers on their schedule, read from the same
files `check` reads for the deployed Worker (`wrangler.jsonc`, `wrangler.toml`,
a deploy template such as `deploy/wrangler.template.toml`). Each run prints one
`RER_SCHEDULED TIME "CRON" ok MSms` line. If two of those files declare different
schedules the server refuses to start and names both files; make them the same.

A server stops after 12 hours (43200 seconds) without activity, so one left
running overnight is still there in the morning. Start it with
`--idle-timeout SECONDS` (or set `RER_SERVER_IDLE_SECONDS`) to change that.

Up to 10 dev or preview servers run on one computer, so several seeds can run
side by side. At the limit a start is refused and the message lists the running
servers with the command that stops each; start with `RER_SERVER_LIMIT=N` to
allow more. A start is also refused while the computer's 1-minute load is
above 36, and the message says so; set `RER_SERVERS_LOAD_THRESHOLD=N` to start
anyway.

A new server is refused only when available memory is below 1.5 GiB. An idle
dev server holds about 0.5-1.3 GiB and a preview about 0.4-0.8 GiB. The message
gives the available memory, the floor and the running servers with their stop
commands; start with `RER_SERVERS_MIN_MEMORY_BYTES=N` (bytes; 0 turns it off) to
start anyway. Reusing a checkout's running server is never refused for memory.

Use the following operations as needed. Reset is destructive local cleanup;
export any data you need to keep before resetting. Export saves under
`exports/`: normalized relative paths such as `exports/x.rer` and
`./exports/x.rer`, and absolute paths inside this checkout's `exports/`, are
accepted. An absolute path outside the checkout is also accepted. Export
refuses other paths in the checkout, `..` segments, unsafe symlinks and any
path served by the app. Import requires an empty destination and `--yes`
confirms the restore.

```sh
rer verify
rer reset --yes
rer export --target local --output exports/installation.rer
rer import --target local --input exports/installation.rer --yes
rer deploy
rer describe
```

## Send your first error

After sign-in, a fresh installation opens `/setup`. Create a project and its
first-run panel shows the ingest key once, the install line and a three-line
`init` filled in with this installation's endpoint and that key, then **Send
test error**, which registers the release and sends one real exception that
appears in Issues:

```sh
npm install @just-every/spool
```

```js
import { init } from '@just-every/spool';
init({ endpoint: 'http://127.0.0.1:8787', project: 'web-app', ingestKey: 'YOUR_INGEST_KEY',
  release: '1.0.0', build: 'local' });
```

Allow your application's exact origin on the project's Capture page. Keys
created while `dev` runs with dev identity work only on requests that carry
this checkout's dev key, so an application elsewhere needs a key created under
`dev --login`. Already using Sentry? Point its DSN at the one Spool shows; see
[docs/SENTRY-SWITCHING.md](docs/SENTRY-SWITCHING.md).

Stop dev or preview with `--stop` or Ctrl-C before build or verification, and
before reset and data transfer. Reset removes only the
declared local inventory: local database/storage state, owner and sessions,
outbox, CLI and installer bookkeeping, and generated private settings. It
keeps source, dependencies, exports and deployment receipts. It refuses active
operations and ambiguous or linked state.

Local export creates a private archive with an integrity receipt and explicit
exclusions. Import validates the archive and restores into an empty destination.
After import, run setup to establish the owner and local configuration. Auth,
outbox, private settings and transient runtime state are excluded. Remote
transfer is unsupported by the maintained references and fails visibly.

Real deployment uses the owner-account procedure and its private credentials.
`rer deploy --dry-run` validates and builds locally without a
provider request. The default environment is `production`; select another with
`--environment NAME`. Local validation does not establish provider acceptance,
hosted health or mail delivery.

`rer describe` reads the current checkout's actual verbs,
flags, aliases, pins, effects and local state without installing or running
project commands. New verbs accept `--help`, `--cwd PATH`, `--non-interactive`
and `--json`. Setup also accepts `--owner-name`, `--port`, `--host` and a
private JSON `--answers FILE`. Dev and preview accept `--port`, `--host`,
`--idle-timeout`, and `--stop`. Deploy accepts `--environment` and `--dry-run`;
export/import accept their target, file and restore options. `check` accepts
`--profile first-party`. Heavy commands accept `--no-queue` only when the
original caller has `CI=true`. Release retains its own compatibility flags.

Use the installed public `rer` for lifecycle commands; no pnpm on PATH is required.

Local durable state is `.wrangler/state`; CLI bookkeeping is `.rer/local`,
installer state is `.seed/installer`, and the default private settings file is
`.dev.vars` with mode 0600. Setup writes this checkout's dev key to
`.rer/local/dev-key.env` (mode 0600); a repeat setup keeps it and reset removes
it, which also ends every browser's earlier dev cookie. Dev sign-in, personas
and the development outbox answer only a request holding that key's cookie, so
a tunnel or local proxy to the app cannot reach them; anything else returns 404.
Any local user or process that can read the checkout can read the key and sign
in as the owner. `rer deploy` refuses the key, and `rer build` refuses output
that contains the dev layer.

The first-party command profile is optional for independently authored
projects. They may keep their own runtime, tools, installer, commands and
provider choices. RER executes only their declared operations and does not
impose Base pins, aliases, outbox or state layout.
