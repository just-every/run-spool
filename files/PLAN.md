# Spool v0.7.10 continuation plan

1. Restore published cc0a05ec50d235f457e03dc5f0be0efa6e413b31 on cloud/sd-spool-release-0-7-10-pc1 without rewriting it. Install fleet credentials and commit hooks.
2. Read repository rules and release metadata; observe latest release, absent v0.7.10 tag, fresh main, and completed prior Verify failure. Retain actual non-secret receipts.
3. Merge newer main into the published candidate, preserving its newer product assertions. Keep contract and generated views unchanged; resolve the source lock by regeneration last.
4. Make only necessary release metadata corrections supported by the merged source. Preserve rer 0.2.107. Run source-lock check, metadata consistency checks and typecheck; do not run a full local suite or add tests.
5. Inspect every candidate commit identity/trailer and diff, then push only cloud/sd-spool-release-0-7-10-pc1 using cloud-push.py. No tags, publication, deploy, main push, workflow dispatch or self-submission.
6. Observe exact-SHA Verify with one REST watcher and at least 300 seconds between reads of a run, within ten GitHub calls. Fix within scope when evidence supports it; report an out-of-scope red assertion as a blocker rather than weakening it.
7. Publish explicit report and receipt files to evidence/sd-spool-release-0-7-10-pc1 independently of product custody. Include exact product and evidence provenance and lane POST in terminal report. Remove disposable clone/dependencies only after product preservation and evidence publication are complete.
