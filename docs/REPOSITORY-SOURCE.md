# Recorded repository source

In Releases, register a release/build with a deployment manifest containing its exact environment, full commit SHA, canonical HTTPS repository and explicit path mappings. Existing registration is immutable and retry-safe. A prefix maps a reported stack root to a repository-relative directory; the longest matching directory prefix wins. Prefixes use the existing canonical path rules; webpack/app URL roots and automatically derived mappings are not supported yet.

Issue detail shows View recorded source for each Python/Go reported coordinate or original JavaScript coordinate that matches the manifest and a mapping. JavaScript first needs the matching private source map. Missing manifests, maps, prefixes, unsupported repository hosts and unsafe paths remain visibly unmapped, with a reason. Selected occurrences and minimized evidence packets use the same current lookup; admission snapshots stay unchanged, including when a manifest is registered later.

Supported link formats are GitHub, GitLab (including subgroups) and Bitbucket, always at the complete recorded revision and line. Each link is labeled owner/deploy-recorded and unverified. Spool neither fetches source nor tests provider access or file existence. The repository provider controls access when the link opens. These links do not claim provider connector grants, revocation, suspect commits, CODEOWNERS, PR comments or real-account qualification.

No new data store is introduced. Existing private manifest/path-mapping archive and erasure custody remain authoritative.
