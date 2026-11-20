# Spool S8 Alerts control names handoff

This round transfers the original Alerts change in just-every/run-spool to the leased handoff branch at commit `8157a49c55c94207abf64b23c4521617043ebe3f`.

## Plan and execution

1. Read the original branch `cloud/sd-spool-s8-edit-names-2` and the destination `cloud/sd-spool-s8-edit-names-c3` over Git. The source matched the lease, and the destination was absent.
2. Fetch the original branch, create the destination locally at the exact commit, and audit every commit in the range from `origin/main`. The range contained one commit with approved author and committer identities and zero trailers. The guarded push created the destination on its first attempt. A second remote Git read returned the exact leased SHA. This round made no product file edits, product commits, merges, or PRs.
3. Discover Verify runs filtered to the full SHA, then poll the new branch run until it completes. Record the results in the receipt and attach the report packet to the published product HEAD on the evidence ref.

## Product and contract

The original change gives each Alerts destination and rule edit control an accessible name identifying what it edits. Its narrow evidence for UX-001 point 1 is `tests/alerts/imported-edit-ui.mjs#importedAlertEditNames`. UX-001 remains partial. The full team and mobile workflow, revoked and offline states, human screen-reader pass, and VPAT remain open.

CONTRACT.md, ACCEPTANCE.md, and docs/CLAIMS.md were identical between the candidate and its parent. Counts in order of done, partial, missing, total were 23/45/19/87 for Core, 0/9/9/18 for Agent surface, 0/0/0/0 for Later, and 23/54/28/105 overall, both before and after.

The contract document check, source-lock check, and Git whitespace check passed. The source-lock command emitted an engine warning for the VM's Node 24.19.0 against the project's 22.20.0 pin. The product checkout was clean. This ref-only handoff used the exact-SHA Verify results for product execution evidence.

## Verify

The original branch Verify run 44649900881 completed successfully on attempt 2 at the leased SHA. Attempt 1 had failed on the Miniflare D1 snapshot assertion in the agent-handoff job at `tests/agent-door/policy-integrity-contract.mjs:46`.

The handoff branch automatically started Verify run 44658027869 on the same SHA. GitHub returned completed with success at the 02:28:38 UTC poll. Both runs passed at the leased SHA, which the destination still advertised after CI. This round issued no Verify dispatch or rerun.

- [Original Verify, attempt 2](https://github.com/just-every/run-spool/actions/runs/44649900881/attempts/2)
- [Handoff Verify](https://github.com/just-every/run-spool/actions/runs/44658027869)
