# SDK-004 linear candidate plan

Author: Run Edit Run fleet. Date: 2026-11-16 UTC.

1. Refresh fleet launcher credentials and install fleet Git identity, credential helper, push guard and commit hooks. Clone only just-every/run-spool; fetch fresh main and SDK-004 source branch.
2. Start cloud/sd-spool-sdk004-4 from fresh main. Apply the complete net patch from the merge base to 0f6c5523e3b4974544a3f73883f9182295bee364 as one ordinary commit, preserving main's later work. Resolve only generated sources.lock.json by regeneration; retain main's CONTRACT.md and generated views unchanged.
3. Compare every original SDK-004 changed file with the previous head, checking unchanged files byte for byte. Explain all differences between the complete old and new trees as newer main changes or the regenerated lock. Confirm zero merges above main, no test registration additions or removals, and correct fleet identities and trailers.
4. Run typecheck, source lock check and contract document check. Build the emitted app, then run the feedbackFlow chain (including privateFeedbackFlow and feedbackMailFlow), endUserErasurePreviewFlow and touched archive recovery assertions with hard timeouts. Preserve screenshots at 1440 and 390 and actual non-secret receipts.
5. Fetch main immediately before the single final product push. If it advanced, reapply on fresh main before publication, rerun necessary focused checks and regenerate lock last. Push with the fleet push guard. Discover and poll exact-SHA Verify through REST within ten calls and 300-second spacing.
6. Save complete report and receipts in this packet, publish selected non-secret files to evidence/sd-spool-sdk004-4 using the report-only entrypoint, and report product custody separately. Delete the successful product clone only after report transport has completed; preserve any unpushed work instead.

Scope is the original 21-file SDK-004 patch, including its member authorization, portability, migration registration and archive/runtime expectation dependencies. No new behavior, contract judgments, generated views, Base refresh, provider account use or main pushes.
