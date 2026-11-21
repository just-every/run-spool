# Local check receipt

Repository just-every/run-spool  
Product branch cloud/sd-spool-dev-persona-1  
Product SHA 965ab13c7f4e519de6c15db56a9230c4f26c45c6

| Check | Exit | Observation |
| --- | ---: | --- |
| Baseline running Worker with the extended dev credentials journey | 1 | Plain key assertion passed. Signed owner link returned 404 instead of 200. |
| Candidate pnpm test:dev-credentials | 0 | Signed owner and pending invitation sessions, scope checks, plain key exchange and existing credential and invitation assertions passed. |
| Candidate pnpm typecheck | 0 | TypeScript no-emit check passed. |
| Candidate pnpm source:check | 0 | Source lock contains the new hashes for the two touched files. |
| Candidate contract-docs check | 0 | Contract documents are current and contract prose has zero errors and warnings. |
| Candidate git diff --check | 0 | Diff passed Git whitespace validation. |

The final journey, typecheck and lock check were repeated with Node 22.20.0 and pnpm 10.12.4. Git confirmed the candidate has one parent on fresh origin/main, passes the fleet identity and trailer audit, and is advertised at the requested product branch.

Recorded 2026-11-21 21:49:47 UTC.

## Running-checkout CLI smoke

The pinned rer 0.2.126 setup and its production build completed. A separate foreground dev run used the checkout's development server and system Chromium for rer's browser readiness check. All three reattachments completed against that same running server with the expected identity:

- Plain detach reattachment reused the original checkout key.
- Explicit owner reattachment announced a signed persona link.
- Invited read-only operator reattachment announced a signed persona link on an installation with a project assigned to that operator.

An initial exploratory member probe used an installation with zero projects. The persona exchange succeeded but existing first-project routing sent the browser to the owner-only setup page, which returned 404. The second probe created a project, granted the invitee read-only access, and passed. The smoke stopped its own dev process.
