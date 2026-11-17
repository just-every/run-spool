Author: Run Edit Run fleet, 2026-11-17

1. Inspect fleet and Spool instructions, the flagged cookie validator and CLI caller.
2. Replace the value's permissive printable-ASCII ranges with RFC 6265 cookie-octet ranges, preserving cookie-name validation, trimming, file handling and error behavior.
3. Exercise the actual CLI status door with a loopback HTTP fixture: preserve valid cookie values, refuse commas/backslashes and every other excluded ASCII octet before a network request. Run the touched regression against the original and changed source, plus the repository typecheck.
4. Declare the intentional Base copy adaptation with adapt-base, preserving its original upstream baseline. Verify the copy record offline. Regenerate sources.lock.json last with the documented source lock command and check it. Leave CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md untouched.
5. Commit under fleet identity with repository-preserving hooks; fetch main and integrate any newer main before publication. Run Base's exact committed-tree publication scanner. Publish only cloud/gr-mt-spool-code-2 if COMPLETE/PASS with zero findings.
6. Discover/poll exact-SHA Verify within the ten-call API budget, retain actual receipts, and publish explicitly selected public evidence on evidence/gr-mt-spool-code-2. Report custody and blockers truthfully.
