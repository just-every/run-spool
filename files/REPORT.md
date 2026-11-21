# Spool dev persona sign-in

Task sd-spool-dev-persona-1. Product candidate 965ab13c7f4e519de6c15db56a9230c4f26c45c6 on cloud/sd-spool-dev-persona-1, based on main at b74b60f34d49b5879c0f0377e1ee997c89d3641c.

## Plan and implementation

1. Compare Spool's local Worker adapter with its pinned Base dev gate, persona grant verifier and scoped session admission.
2. Pass the Base redeemer from Spool's key exchange. Validate the signed grant against Spool's current persona list, resolve the selected account through the same entry logic as the existing dev sign-in, and issue a cookie bound to that session. The full checkout gate remains available through the plain key exchange.
3. Extend the existing dev credentials journey against a running local Worker and migrated D1. Check the plain exchange, owner session, an invited member's session and project access, refusal of unknown and mismatched persona grants, and the inability to use a persona session to enter the owner shortcut.
4. Check the touched journey, typecheck, contract generator and source lock. Publish the single linear product commit and verify its exact SHA through the branch workflow.

## Results

- The new owner assertion reproduced the original defect on the base adapter with HTTP 404. It passed after wiring the redeemer.
- The running Worker exchanged the owner link for the owner session and an invited operator's link for the operator's read-only project access. It rejected unknown or mismatched persona grants. The plain exchange returned HTTP 204 and only set the gate cookie.
- The existing direct entry, invitation-link, credential-scope and deployed-entry assertions also passed.
- No test registration was added. The existing dev credentials journey count is 1 → 1. Full contract status is 23 done, 54 partial, and 28 missing before and after.
- No contract clause claimed; this is a dev-identity defect fix for SEED FAULT S10.

Recorded 2026-11-21 21:47:48 UTC.

The pinned CLI also passed plain, owner and invited-operator reattachment against a running checkout with a project. A project-free exploratory run confirmed that successful persona exchange still leads to Spool's owner-only first-project setup, which refuses members.

Exact-SHA Verify run 44953299622 completed successfully, observed at 2026-11-21T22:12:27+00:00. https://github.com/just-every/run-spool/actions/runs/44953299622
