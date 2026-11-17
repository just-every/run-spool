# Spool minimatch maintenance

Run gr-mt-spool-dep-13 fixes Dependabot alert 81 (GHSA-g3hv-75wg-m249) for just-every/run-spool. Candidate branch cloud/gr-mt-spool-dep-13, head 0e9dcab93c04383708923b760b25c954e34e805d, based on main at 53b460837d5a58266c39d03a9f923e09e9c29fb7.

## Plan and implementation

1. Trace the affected version in the workspace lock and check published releases of its parent. The Sentry bundler plugins resolve glob 13.0.6. The Sentry pins use the glob 13 line, whose releases through 13.0.7 still require minimatch 10.
2. Apply a pnpm override scoped to glob 13 in package.json. Use minimatch 11.0.1, the first patched release in the advisory, and keep the Sentry and glob versions unchanged. Regenerate pnpm-lock.yaml with pnpm 10.12.4. Its only added package is the required @isaacs/nonrecursive-glob-match 1.1.0. Regenerate sources.lock.json for the two changed file digests.
3. Verify a frozen install and the resolved chain using Node 22.20.0 and pnpm 10.12.4. Build the application, typecheck, exercise the Sentry source-map compatibility journey, and check the source lock and contract documents.
4. Scan the exact candidate with Base's publication scanner before publication. Push only the named product branch after the local checks and scan pass. Record exact-SHA Verify and return the evidence through the evidence ref.

## Counts and scope

- Distinct affected minimatch versions in pnpm-lock.yaml decreased from 1 (10.2.6) to 0. The one resolved minimatch version is now 11.0.1. Five installed Sentry dependency paths converge on it.
- Full target clause counts remain 23 done, 54 partial, 28 missing, and 105 total. Core remains 23 done, 45 partial and 19 missing. Agent surface remains 0 done, 9 partial and 9 missing. There were no clause or test registration changes.
- This change is limited to package.json, pnpm-lock.yaml and sources.lock.json.

[Dependabot alert 81](https://github.com/just-every/run-spool/security/dependabot/81)

## Local results

The frozen install, dependency trace, CI application build, TypeScript check, Sentry CLI compatibility journey, source-lock check, contract-doc check and diff whitespace check passed. The Sentry journey uploaded source maps through Vite, esbuild, Rollup and webpack, then completed its CLI release, chunking, refusal, archive, restore and erasure assertions. The frozen install reported the existing ignored build-script policy for @sentry/cli. The installed CLI still worked in the journey.

## Publication

Base main scanner source came from the GitHub source archive at 221a331181f8fbafba3510edc977a3d471f9ac52. Out-of-tree version metadata identified that revision for the archive, which omits Git metadata. The default 300-second scan reached its deadline. A second full scan with a longer time budget completed with PASS and zero candidate findings. It classified 17 observations as already present on the public base. The scan and push receipts record the exact commit and tree. Git reported a successful push on the first attempt, and the branch ref resolved to the same full SHA.

## GitHub Verify

Verify run 44198806456 completed successfully on the candidate SHA. [Exact-SHA run](https://github.com/just-every/run-spool/actions/runs/44198806456)

Run Edit Run fleet, 17 November 2026
