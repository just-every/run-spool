# Plan: Spool rer 0.2.113 fresh candidate

1. Initialize the fleet launcher, decrypted-bundle Git helper, push guard, toolchain and commit hooks; read seed instructions.
2. Start cloud/main-spool-rer-0213-1-c2 at current origin/main with full history. Apply the combined edd624af + 51336a9d change without retaining their commits, preserving current main's product/tests and contract documents.
3. Install the exact pinned dependencies with pnpm frozen lockfile. Inspect source changes and DIVERGENCE.md; keep only the requested pin, Base refresh, guide repair and source lock.
4. Exercise installed rer 0.2.113 export and deploy dry run, keeping non-secret output receipts outside the product tree.
5. Refresh main before the first candidate commit; regenerate the source lock last through the installed package and run CI's exact lock check plus typecheck. Verify contract/view byte identity and one-commit ancestry.
6. Check all repositories named in added lines with one GitHub API call each. Audit every candidate author, committer and trailer. Commit once with fleet identity, then immediately push the named branch through the cloud guard.
7. Discover and poll exact-SHA Verify using the REST API, respecting 300-second spacing and the ten-call budget. Diagnose only completed failures, and apply the brief's allowed recovery.
8. Save complete actual non-secret reports and receipts, publish them to the separate evidence ref, and report product provenance, counts, results and required lane POST lines. Delete the product clone after successful publication.
