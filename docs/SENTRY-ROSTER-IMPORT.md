# Sentry roster and ownership review

Run Edit Run fleet, 17 November 2026.

The existing owner import door accepts synthetic or authorized API-response
bundles. Import creates pending **review records**, never native people,
invitations, email, sessions, keys, grants or notification routing. These are
not invitations that can be accepted. Settings → Organization → Members →
Imported roster and ownership shows them; the owner separately chooses Create
native invitation. That action uses the existing invitation, acceptance,
project-grant and revocation services. Installation ownership, verified email,
SSO, password and 2FA trust never transfer.

The local bundle envelope remains `spool-sentry-org-export`, version 1. Each
collection has `kind`, `project` and cursor-checked `pages`. Each page carries
`cursor`, `nextCursor` and an unchanged API `response` array. The ownership GET
returns one object; put it in a one-row response array. A `team-members`
collection additionally names its `team` slug and has `project: null`. This
wrapper is Spool's transport envelope, not a claimed Sentry export format.
The records inside it follow these public Sentry API schemas, consulted on
17 November 2026:

- [Organization members](https://docs.sentry.io/api/organizations/list-an-organizations-members/): `members`, organization scope.
- [Organization teams](https://docs.sentry.io/api/teams/list-an-organizations-teams/): `teams`, organization scope, including exported project memberships.
- [Team members](https://docs.sentry.io/api/teams/list-a-teams-members/): `team-members`, with `teamRole` and `teamSlug`.
- [Project ownership](https://docs.sentry.io/api/projects/retrieve-ownership-configuration-for-a-project/): `ownership`, project scope, with `raw`, `schema.$version`, ordered `schema.rules`, `dateCreated`, `lastUpdated`, `isActive`, `autoAssignment`, `codeownersAutoSync` and `fallthrough`.

Project scopes come from explicit exported team memberships and project/team
links, never `hasAccess` or the exporting user's `access` list. An unknown
organization or team role is rejected for review. Source owner becomes a
proposed admin, admin becomes admin, manager becomes member with explicit
maintainer projects, billing has no project grants, and member gets only
exported team projects. A team's admin proposes project maintainer; its member
or contributor proposes member. Active, pending and expired source members all
remain pending reviews. A new invitation always requires an owner's later
choice, including for an expired source invitation. No original invitation link
is copied. The native organization must already exist before invitation. That separate
owner action binds missing selected projects to the native organization before
using native grant validation; the import itself never writes native teams.

Exact private originals and source identities stay in the existing import
journal. The plan reports record/byte counts and omitted top-level fields;
reconciliation covers the new target kind `import-proposal`. Retrying the exact
bundle resumes the same plan/job. Undo removes unchanged proposals. Creating a
native invitation first changes its source review version, fencing import undo
before any outbound action. Native project grants and service scopes also fence
project deletion by undo. A sender failure can leave a review in `inviting`:
inspect Members and use the ordinary native invitation controls after reviewing
the result; the import cannot retry mail or roll native authority back.

Ownership retains the original raw text, complete schema, owner IDs and source
timestamps as disabled proposals. Preview uses an explicit, deterministic
**first matching source rule** proposal order and lists every overlapping
match and unmatched sample. It supports bounded `path`, `url` and
`tags.environment` glob samples; all other matchers and schema versions are
reported unsupported. Owners resolve only against exported user IDs and team
IDs. This is a review policy, not a claim to reproduce Sentry's live routing
precedence. A timestamp is not a linked repository revision. There is no live
enable action: exact linked CODEOWNERS revision, native accountable assignees,
destinations and delivery still require TEAM-002 work. No repository provider
consent, CODEOWNERS fetch, auto-sync or notification is imported.

Fields that have no native effect:

- Members: `user` contributes only its source user ID for ownership review;
  email verification, names inside `user`, username, avatar, status, password,
  management, login/activity, experiments, staff/superuser and 2FA fields confer
  no trust. `flags`, `inviteStatus`, `inviterName` and every additional top-level
  field are named in plan omissions. `pending`/`expired` are history only.
- Teams: `access`, `hasAccess`, `isMember`, `teamRole`, `isPending`, `memberCount`,
  `avatar`, `flags` and other unknown fields do not authorize anything. In nested
  `projects`, only slug participates in scope mapping. The team membership
  response contributes member ID and team role; all other fields are duplicate
  roster context retained in originals only.
- Ownership: `isActive`, `autoAssignment`, `codeownersAutoSync` and `fallthrough`
  are retained as source history, never executable settings. Raw/schema remain
  exact private review data; unknown matcher semantics remain unresolved.
- Projects: only ID/slug/name/creation form the native project. Team links help
  propose roster scopes but never create native team authority during import.

Review data participates in private archives and restores pending, with no
native authority. Permanent audit contains safe aliases, action/time/outcome
only; it never copies source email, raw ownership or sample paths. Project
erasure withdraws shared review records, import lineage and private originals;
shared proposals are removed whole rather than retaining another project's
copy of personal fields. Owner self-erasure holds while shared import review
custody exists, including after native archive restore. Erase those projects
first. Externally downloaded exports, sent mail and provider backups remain
outside the installation fence.

`tests/sentry-import/roster-ownership.mjs` is folded into the existing Sentry
journey. It uses synthetic documented API responses and native local fixtures;
no real Sentry or repository account, delivered real email, production dual run,
cutover or completed TEAM-002 is claimed.
