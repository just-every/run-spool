# Members and project access

Open **Settings → Members** to create the installation's organization, invite
people, set project grants and teams, manage service accounts, or transfer
ownership. Invitations use the native one-use email confirmation. Development
mail stays silent; hosted invitations need a configured mail sender.

The owner retains installation custody, imports and erasure. Organization admins
manage members and all organization projects. Billing accounts see usage and the
availability of budgets and invoices, with no project evidence. A project
maintainer manages its policies and alerting; members triage and deploy in their
granted projects. Read-only collaborators read their granted evidence and cannot
write. Project refusals use the same response as an unknown project.

Removal revokes native sessions, minted agent/deploy/ingest keys and sponsored
service accounts. A transaction rechecks the session, current membership version
and project grant before it commits. Narrowing a grant permanently retires keys
that lose their authority; adding access later never revives those keys.

Service accounts have an accountable sponsor and explicit project/purpose
scopes. Create separate agent, deploy and ingest keys only for those scopes.
A service key cannot use a coincident browser cookie to expand its authority.

## Team notifications

The authenticated project HTTP API exposes the team controls under
`/api/projects/<project>/alerting`:

- `GET /team-controls` reads the current team's settings, snoozes, suppressed
  count and safe mail states.
- `PUT /team-digests` accepts `member`, an IANA `timezone`, boolean
  `daily`/`weekly`, and `hour` (0–23). Each recipient receives only projects
  they currently read. A queued summary retains its membership and project
  snapshot and is blocked if that authority changes.
- `POST /team-snoozes` accepts `scope` (`team`, `issue` or `rule`),
  `target` and a required future `until` timestamp in milliseconds.
  Capture continues; held deliveries stay counted and listed. Expiry creates
  one durable resumption notice for the creator, without releasing held alerts.

An owner/admin, or a maintainer of every project in the team, manages these
team-wide settings. Project `PUT /follow-up/alternate-member` accepts an active
accountable project member's `member` id, or `null`. The existing follow-up
view shows overdue work, a broken alternate and deduplicated notice outcomes;
a failed alternate notice never recursively notifies itself.

## Archives and erasure

Private archives retain organizations, grants, invitations and service
configuration as inert records. They exclude sessions and project keys; digest
schedules disable, snoozes become historical, and restored mail never sends.
Safe audit facts retain their original aliases, times, actions and outcomes.

Project erasure removes its grants, service scopes/keys, alternate and cached
summaries, and the team's notification configuration when its last project
leaves. Owner erasure removes the former owner's membership, sponsored authority
and notification links while preserving other members and safe audit facts.
