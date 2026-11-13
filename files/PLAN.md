# Spool 0.7.9 metadata candidate plan

Task: sd-spool-release-0-7-9. Repository: just-every/run-spool. Product branch: cloud/sd-spool-release-0-7-9 (the cloud assignment overrides the historical 0.7.8 branch in the embedded brief).

1. Refresh the fleet launcher, install decrypted-bundle Git authentication, fleet identity and co-author cleanup hooks, and clone the declared repository shallow with blob filtering.
2. Read the launcher and seed instructions and the inline builder/release references. Read the contract and generated acceptance document without changing them.
3. Confirm current main has exact-SHA successful Verify and Run site, v0.7.9 has no existing tag or GitHub Release, and no v0.7.9 release branch competes with this task. Compare the actual v0.7.8 tag with main, including migrations and metadata paths.
4. Update application version metadata, existing release-version references, RELEASE.json and a new honest CHANGELOG section. Keep all old notes, all product/tests/contracts and the rer pin unchanged. Do not add release-history records or create a package lock where none exists.
5. Fetch and rebase main before the first push. Regenerate the source lock last with the seed's documented command, check it, check metadata consistency and scope, and typecheck. No new tests, full local suite, browser proof or release publication for this metadata-only assignment.
6. Commit with the required explicit fleet author and committer environment and active hooks. Audit every candidate commit and trailer, including side parents, and push only the named cloud branch through cloud-push.py.
7. Discover and poll exact-SHA Verify through gh api, at most once per 300 seconds and within the ten-call budget. Fix any scoped failures if possible; never rerun or dispatch the same SHA, push main, create a tag or sign/publish a release.
8. Preserve complete non-secret reports and actual receipts outside the product checkout. Publish only explicitly selected packet files to evidence/sd-spool-release-0-7-9 with cloud_evidence.py. Delete the product clone/dependencies after successful preservation and publication. Return product provenance, CI, unchanged counts, no clause changes, lane POST lines and READY or PUSHED as warranted.

Publication scanning and landing remain the guarded Mac fleet's responsibility. READY is candidate custody only, not RELEASED or product acceptance.
