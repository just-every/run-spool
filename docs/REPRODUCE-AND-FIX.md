# Reproduce, fix and measure

The issue page's **Reproduce and fix** section takes one captured failure through three steps: run it again in isolation, carry a fix through a reviewable branch under a grant you approve, and measure after the deploy whether the fix reached the users who hit it. Each step reports what it could not establish.

## 1. Reproduce in the sandbox

Declared defect class: `js-exception-mapped-frame`, a JavaScript exception whose first frame maps through a stored source map to an ES module (`.js` or `.mjs`) whose source text the map carries. Anything else is recorded as **unsupported** with its reason (imported history, an unmapped frame, a map without source text, TypeScript or other source that needs a build step, an unusable path, more than 1 MiB of module source). Nothing runs for an unsupported reproducer.

A supported reproducer records exactly what will run: the event's type, message and mapped frame; the module and export to call (by default the function enclosing the mapped line); the JSON argument list you give (text the scrubber would change is refused, not altered); every module the map carries, by SHA-256; the sandbox it needs; and the runner protocol.

**Queue sandbox run** returns a single-use token, valid for 15 minutes and for that run only, and prints the command to run in your Spool checkout:

```sh
SPOOL_RUN_TOKEN=… pnpm reproduce https://your-spool/api/sandbox/runs/<run>
```

The runner fetches the job once and starts one `workerd` process with an empty process environment and two services. The job service runs the map's modules with no bindings, no disk service and an outbound network service with an empty allow list. A separate harness service, which loads no job code, calls the export once through a service binding with the input parsed from JSON (never spliced into code), builds the observation in its own isolate from what comes back (the value, or the thrown error with the stack the engine attached), and alone writes it through a disk service the job cannot reach. Nothing the job prints or imports can author or suppress the observation, and the job-side entry calls the export with primordials captured before any job module loads, so patching iteration, `then` or `Reflect` does not turn a normal return into a throw. A job that hangs or crashes never answers, which is a failure, never a reproduction. The process is killed after 10 seconds. The runner reports only what the harness observed, plus the `workerd`, Node and runner versions, and refuses a job that asks for any other sandbox.

Spool decides the outcome by comparing that observation with the captured event, never from a claim (a report that names an outcome is refused):

- **Reproduced**: same exception type, same scrubbed message, and the first frame in the mapped source file at the mapped line. The column is shown but not required, because maps point at an expression and V8 at the throwing token.
- **Not reproduced**: the call returned, or threw something that does not match. Checks show which part differed.
- **Failed**: the export is not a function, the modules could not load, the call was killed, the sandbox failed, or the token expired before a report.

### Trust boundary

The modules a reproducer runs come from your project's own authenticated source-map upload. A verdict is therefore labeled **reproduced by your uploaded source** (in the API, `label` and `basis` on each run): it says what that source did in the sandbox, not that the source is honest. Code in the upload can still shape its own throw: it can throw an error whose name, message or `stack` it set itself, or patch globals that its own async functions then depend on, and such a throw is reported as it happened. Treat a verdict as proof only about code you trust; it is not proof against hostile uploaded code. The sandbox's guarantees are about isolation: uploaded code gets no network, no secrets, no files and no bindings, and it cannot author the harness's observation outside its own call.

Run the same reproducer against a later registered release whose map carries the same file to check a fix's behavior: **Not reproduced** there is independent evidence that the fixed code behaves differently.

The sandbox runs on the machine where you run the command. Spool's own Worker never executes reproducer code, and the workerd Worker Loader binding that would let it is not part of the Base deployment contract.

## 2. Fix branch under an exact, expiring grant

From a run Spool confirmed as **Reproduced**, propose a fix branch: the repository (its owner and name), base branch, the affected flow your SDK reports, and how long the grant lasts (1 to 10,080 minutes). The proposal records the exact grant: the branch `spool/fix-…`, the one file it adds (`.spool/reproducers/<id>.json`, the reproducer record as data, by size and SHA-256), a draft pull request with a fixed title and body, the operations Spool may perform, the GitHub token permissions (`contents: write`, `pull_requests: write`, `checks: read`, this repository only) and what it never does (write the base or any other branch, merge, force-push or delete, tag, release, deploy). GitHub cannot limit `contents: write` to one branch; Spool refuses any write outside the grant, and repository rules should protect the base branch.

Approving starts the grant's clock. Each step mints a GitHub App installation token for this repository with exactly those permissions, refuses and revokes it if GitHub returns anything broader, performs the step and revokes the token. Every provider call, failure and refusal leaves a receipt with the facts it established and never a token. A workflow holds at most 200 receipts. Each step first takes the workflow's step lease, in the same write as its claim and only when the budget can hold the whole step, so concurrent steps cannot both run and a step that might not fit is refused before anything is sent. No token is ever minted without a receipt, and a minted token is revoked even when the step fails. Repository names match GitHub's canonical name in any case. Each owner-triggered step also writes a `fix_advanced` audit entry. After expiry, Spool refuses without contacting GitHub until you approve a renewed grant.

States are recorded independently: **proposed** and **approved** by you; **merged** only from a receipt of GitHub's pull request state (Spool never merges); **deployed** only when a deployment manifest registered for this repository names the merge commit, or a compare receipt shows the deployed commit contains it.

### GitHub connection availability

**The issue page cannot add, repair or test a GitHub connection.** It shows this limitation and its reasons before you open connection details. Creating a GitHub App alone does not connect Spool.

**Hosted setup is unavailable on the current install.** `deploy.json` does not declare `GITHUB_CONNECTION`, so `rer deploy --set-secret GITHUB_CONNECTION` refuses it as undeclared. Declaring it as required would force every installation to supply GitHub credentials; hosted setup needs deployment support for this optional integration. Do not add it through the Cloudflare dashboard: a manual Worker change invalidates rer's recorded deployment identity and can block subsequent updates.

**Local setup requires operator changes outside the page.** Someone with access to the Spool checkout and permission to manage and install a GitHub App must do the following:

1. Create or use their own GitHub App with repository permissions **Contents: Read and write**, **Pull requests: Read and write**, and **Checks: Read-only**. Install it on the target repository. Protect the base branch with repository rules; GitHub cannot restrict Contents permission to the fix branch.
2. Record the numeric **App ID** from the App's settings, generate and download its PEM private key, and record the separate numeric **installation ID** from the installed App's configuration URL (the number after `/installations/`).
3. Build one JSON value for the `GITHUB_CONNECTION` secret: `{"appId":"…","installationId":"…","privateKey":"synthetic-example-pem-private-key"}`. Encode the PEM line breaks as `\n` inside the JSON string. Keep the real key private.
4. Stop Spool with `rer dev --stop`. Add `GITHUB_CONNECTION=` followed by that one-line JSON value wrapped in single quotes to the checkout's private `.dev.vars` file (mode `0600`), preserve the other settings, and restart with `rer dev`.
5. Reload the issue page. **Configured** means Spool accepted the settings' format; it is not a successful connection test. A successful approved step establishes GitHub access. Approval with a connection can immediately open the branch and draft pull request, so review the exact grant first. For an already approved, unexpired grant choose **Open branch and draft pull request**; renew an expired grant to continue. Provider failures appear on the issue page and in the workflow's receipts.

Without the connection, an approved workflow stops at **Approved, awaiting connection**, with no provider request and no receipt; approval still starts the grant's expiry clock. The initial branch contains only the reproducer record as data. You supply the code fix; Spool never merges, releases or deploys.

## 3. Did the fix reach the affected users?

Exposure needs two SDK signals, both in `@just-every/spool` 0.2.0 or later. As of 2026-10-15, SDK 0.2.0 is owner-held and unpublished on npm; `npm install @just-every/spool` installs 0.1.0, which cannot send these signals. The app release does not publish the SDK. The example below requires a separately supplied 0.2.0 SDK artifact or a future authorized npm release; it is not available from the current npm install. See the [SDK release notes](../packages/sdk/CHANGELOG.md).

The signals are a random `client` identifier (never a name or address; in the browser `anonymousClient()` makes and keeps one) sent with errors, and flow reports:

```js
import { init, anonymousClient } from '@just-every/spool';
const spool = init({ endpoint, project, ingestKey, release, build, client: anonymousClient() });
spool.exposure('checkout'); // when the page reaches the checkout flow
```

Reports go to `POST /api/ingest/<project>/exposure` with the ingest key: `{"version":1,"release","build","environment","client","flows":[…],"capture":true}`. A refused report is counted (`exposure_invalid`, `exposure_unregistered`, `exposure_budget`) because lost exposure is a capture gap. A project keeps at most 20,000 exposure rows.

Once the fix is deployed, Spool computes from stored events and reports, in the deployment's environment:

- **cohort**: users who hit the failure before the deploy, how many reached the fixed flow, and events without a client;
- **rollout**: users active since the deploy and the share on the fixed release or later;
- **traffic**: session reports on the fixed release;
- **instrumentation**: users who reached the affected flow on the fixed release with and without capture installed, and the pre-fix failure rate among users who reached it before;
- **capture gap**: server-side event and exposure loss since the deploy, and exposed users without capture.

The verdict is **Recurred** when the failure arrives from the fixed release after the deploy. It is **Reached the affected users** only when previously affected users reached the flow with capture, there is a pre-fix rate, no loss since the deploy, and the chance that the old failure rate would produce no failure among the exposed users is below 5%. That rate is the lower end of the exact (Clopper-Pearson) 95% interval for the baseline, so a small baseline counts for little: one affected user who was the whole baseline supports a rate of only 2.5%. Otherwise it is **Inconclusive** with each missing denominator named, however quiet the feed. Users without a client identifier or flow reports, failures lost in the client before transport, and failures grouped differently after a rebuild are outside these denominators.

## Archives and erasure

Reproducers, runs, fix workflows, receipts and exposure reports travel in owner archives and restore unchanged; run tokens do not, so a restored queued run can no longer be claimed. Project erasure deletes all of them, including run tokens.

Python and Go capture is evidence only. Reproducer requests explicitly return unsupported for either language, including deceptive JavaScript file extensions and debug IDs.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.
