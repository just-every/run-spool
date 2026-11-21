# Local verification receipt

Node 22.20.0, pnpm 10.12.4 and rer 0.2.126. Browser journeys use headless system Chromium with the no-sandbox flag.

## Dependency, Base and source checks

1. pnpm add -D -E @runeditrun/rer@0.2.126
2. pnpm install --frozen-lockfile
3. pnpm exec rer --version
4. pnpm exec rer refresh-base --ref 3637852064bf6ddadd15418518964d99d615cc46 --base ../base
5. node src/base/contract-docs.mjs write
6. node src/base/contract-docs.mjs check
7. git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md
8. node scripts/edition-authoring/cli.mjs lock
9. pnpm source:check

The frozen lock installed and the CLI reported 0.2.126. The refresh ended with “refresh-base: complete (exit 0)”. Contract checks reported “Wrote 0 contract documents”, “Contract prose: 0 errors, 0 warnings” and “Contract documents are current”.

## Ordered build gate

| Sequence | Command | Result |
| --- | --- | --- |
| 1 | node tests/native-export.mjs | Passed |
| 2 | pnpm run check -- --profile first-party | Passed |
| 3 | pnpm source:check | Passed |
| 4 | node scripts/edition-authoring/cli.mjs verify-base --offline | Passed |
| 5 | pnpm run build:app | Passed, emitted client and SSR Worker |
| 6 | pnpm integration:check | Passed, integration deployment spec, setup digest and producer workflow match |
| 7 | node scripts/agent-door/surface.mjs --check | Passed |
| 8 | pnpm typecheck | Passed |

## Adoption behavior

- node tests/old-archive.mjs exited 0. The populated published-release upgrade preserved 177 tables and 120 rows. The older 0068 upgrade preserved 202 tables and ran five additive migrations. The populated 0110, 0112, 0113, 0111, 0114 order retained evidence, key authority and roster proposals. Old and current archives restored independently. A populated destination, mismatched schema and corrupted archive binding each refused.
- The emitted Worker/D1 product journey passed independent archive restore, retention and the browser capture checks. The admission suite passed the additive existing-owner migration, native claims and the owner mapping archive restore.
- The scratch Worker migration fixture ran against Spool's vendored archive engine and rer 0.2.126's installed Worker history and evidence modules. Three tests passed. Interleaved native owner history retained the owner ALTER and row, invalid owner history returned HTTP 409 with zero rows, and reordered Platform history completed when replay reproduced the archived schema. A reorder that changed the schema refused.
- The Base held-inspection and bounded-bootstrap fixtures passed. The installed Spool pin's cached-pnpm probe was checked with simulated load and synthetic child output. It used 10, 20 and 30 seconds at idle and capped deadlines at 40, 80 and 120 seconds under high load. The fixture applied no machine load.
- Candidate Gitleaks scan covered one commit and reported no leaks. Exact candidate identity and trailer checks are recorded in the product push receipt.

## README journey on candidate 8f6f09a0a134ddea003074d11330c8c2b695a2f9

The source and destination worktrees were created from the same candidate. Both installed the frozen lock.

| Command | Result |
| --- | --- |
| npx -y @runeditrun/rer@0.2.126 setup --owner-email &lt;owner&gt; --non-interactive | Exit 0. Setup applied 108 migrations, claimed the local owner and exited. |
| npx -y @runeditrun/rer@0.2.126 build | Exit 0. |
| Installed rer dev --foreground --port 15560 --json --non-interactive | Ready. GET /health returned HTTP 200. Chromium opened the printed owner link and created a synthetic project with HTTP 201. |
| Installed rer preview --foreground --port 15561 --json --non-interactive | Ready. GET /health returned HTTP 200. Chromium opened the printed native owner link and read the populated project list with HTTP 200. |
| npx -y @runeditrun/rer@0.2.126 export --target local --output &lt;archive&gt; | Exit 0 after stopping the owned servers. |
| npx -y @runeditrun/rer@0.2.126 import --target local --input &lt;archive&gt; --yes | Exit 0. The independent worktree had no local state before import. |
| npx -y @runeditrun/rer@0.2.126 export --target local --output &lt;restored archive&gt; | Exit 0. Re-export contained the identical synthetic project row and excluded project credentials and owner identity. |

The first dev attempt stopped with owner_entry_not_ready after the cold Chromium download exceeded the command's 60-second browser-prerequisite deadline. The retry used the provisioned browser and reached readiness without changing product code or raising the deadline. The external browser assertions used system Chromium.

The repository's command suite also passed through rer verify. It covered fresh-clone locked bootstrap, owner setup and preservation, dev and preview, owner sign-in and first-run setup at 1440 and 390, active reset refusal, CLI archive portability and deploy dry-run. The application verification target reported “Spool verification passed: product, admission, commands”.

The top-level pnpm exec rer verify exited 0 after those application suites, hosted output and hydration, Agent Door conformance and statement-size checks. Its final lines reported “Agent door conformance: 9191/9191 points passed”, “1060 view and trigger statements checked” and “verify: complete (exit 0)”.

## Exact-SHA Verify follow-up

The original runtime shard reported ERR_ASSERTION after its public docs navigation probe. A local replay recorded only safe stack coordinates and identified tests/setup-prerequisites.mjs:53 as the stale Base link assertion. After updating the guide links and regenerating the source lock, the ordered local build, both source checks, typecheck and the entire runtime journey passed on the follow-up tree 2681b8aa457a70c154e8012b6080c055c756a2cc.

The relevant output was “Settings prerequisite guides passed: Slack and cron reach pinned Base owner steps and a working receipt-to-binding recipe” followed by “Spool runtime: DB health, server document gate, direct API gate, local owner admission, second-claim refusal and immediate revocation passed.” and “Spool verification passed: runtime”.

On the published follow-up SHA, a second top-level pnpm exec rer verify selected the runtime suite and exited 0. The unchanged runtime test followed the repaired owner-guide links, and the closing output again reported 9191/9191 Agent Door conformance points and 1060 checked view and trigger statements.

The runtime shard's other local checks also cleared. The demo-capture, deployment-history and audit-history tests exited 0, as did browser-origin and dev-credential tests. The old-archive and emitted Worker product checks are recorded above.
