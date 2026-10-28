# Issue short IDs and commit citations

Every issue has a short ID such as `CHECKOUT-1A3`: the project's prefix, a dash and a per-project number in Crockford base32 (digits and capitals without I, L, O or U). The prefix comes once from the project identifier in capitals, with `.`, `:` and `_` written as `-`; it never changes. When another project already holds that prefix, the new project takes `<prefix>_2`, `_3` and so on. An erased project's prefix stays retired, so an old commit message can never point at a newer project's issue. Numbers count up and are never reused.

The short ID appears in the issue list, the issue view, the evidence packet, the agent CLI and MCP (`spool-agent packet CHECKOUT-1A3`, `get_packet`), JSON and CSV exports, alert email, webhook bodies and digests. Search finds an issue by its short ID or alias in any case, and an issue link, packet request or citation may use either form.

Merging moves an issue's short IDs to the issue that absorbed it: they stay valid as aliases and open the survivor everywhere. Splitting keeps the original's ID and gives the split-out issue the next number. Undo restores the recorded mapping; a split-out ID then opens the original, where its occurrences returned. A merged-away issue that captures again gets a new number.

## Citations from commits

A deploy key (or the owner) sends commits with a release registration or a deployment start. Each commit is a full SHA, or an object with its message and author, kept as sent:

```sh
curl -X POST "$SPOOL_URL/api/projects/checkout/releases" \
  -H "Authorization: Bearer $SPOOL_DEPLOY_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"web@1.1.0","build":"web-11","commits":[{"sha":"<full SHA>","message":"Fixes CHECKOUT-1A3: guard empty carts","author":{"name":"Dana Developer","email":"dana@example.com"}}]}'
```

`POST /api/projects/<project>/deployments` accepts the same objects in `includedCommits`, oldest first and ending at the deployment commit. A bare SHA, the earlier form, carries no citation. A request holds up to 500 commits and 512 KiB; a message holds up to 8,192 characters and passes the capture scrubber before storage.

`Fixes`, `Resolves` or `Closes` in any case, followed by a short ID or alias, links the commit to that issue at once, any number per message; the issue's **Commits and resolution** timeline shows it. Only an exact short ID or alias of a live issue in the same project links. Anything else changes nothing and is listed in the owner's **Repository link log** (Releases) with the literal citation, the commit SHA and the reason: `unknown` (no issue has that ID), `other_project` (it belongs to another project) or `inaccessible` (it names imported history, which a deploy key cannot change). Spool never guesses a near match. The registration answers with the citations it linked and a count of logged ones; reasons stay with the owner. Repeating a registration adds nothing.

## Resolution and regression

A linked issue resolves in the first release, under the project's SDK-028 ordering rule, that includes the cited commit: the registered release or deployment release, or a release auto-created from SDK events whose name is the commit's full SHA. The issue records the commit SHA, its author and the release; the PR stays empty until SRC-002 supplies one. This is SDK-009's named resolution, so an occurrence in that release or a later one regresses the issue under ERR-006 with one regression alert, an older-release occurrence cannot, and a release-less occurrence is counted without reopening it. Each resolution raises the issue revision, so an owner or bulk decision made before it is refused as stale.

## Author and message

Commit author and message are personal data. They show on owner screens: the issue timeline. Packets, agent CLI and MCP reads, alert email and webhook bodies and exports carry the short ID, citation, release and commit SHA only, until the owner turns on **Commit author and message** in Settings. That choice is per project, off by default, revision-fenced and recorded in the audit history; digests never carry them.

A retention cutoff removes the author and message of every commit received before it, and from the copies a shared alert carried, while the SHA, link and resolution stay. Project erasure removes every commit, link, log row, short ID and prefix of the project; installation-owner erasure replaces the owner's name and address wherever they stand as whole tokens in a commit author or message. The private archive carries all of it, and a restore is inert: it never re-runs a resolution or sends anything, and an archive made before short IDs has its issues numbered in first-seen order, exactly as migration `0059_short_ids_commit_citations.sql` numbered existing issues.

## Provider sources

GitHub pull request and GitLab merge request citations, merge commits and connected-repository SHA association arrive with SRC-002, and `sentry-cli releases set-commits` with SRC-003. Both feed this same parser, link log and resolution. SRC-003's unmodified `sentry-cli releases set-commits` (`--auto`, `--commit` and `--local`, which send the commits of the client's git checkout) now does ([SENTRY-CLI.md](SENTRY-CLI.md)); no real provider receipt is claimed until SRC-002 ships.

## Moved from CONTRACT.md

The contract cleanup of 28 October 2026 moved this mechanism here from CONTRACT.md; the clause keeps the requirement.

Migration `0059_short_ids_commit_citations.sql` numbers existing issues in first-seen order, and a restore of an older archive numbers its issues the same way.

Until SRC-002 delivers provider pushes, commits reach Spool through the deploy-key release door (`commits`) and deployment door (`includedCommits`), each a bare full SHA (no citation) or `{sha, message, author: {name, email}}` with author kept as sent and the message scrubbed.
