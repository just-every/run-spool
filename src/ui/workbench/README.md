# Triage views

`Workbench` owns the signed-in installation and destination, not the forms.
`useProjectData` clears cross-project data and rejects mismatched packet identities.
The view files own their workflows; `DraftProvider` keeps unsubmitted values in
memory across in-app navigation, including selected files. Signing out or a page
reload clears these drafts. Keys never enter URLs or browser storage.

The URL identifies the project, view and optional issue:
`/projects/<project>/issues/<issue>`. TanStack Router owns history. A direct issue
request is protected by the server's owner document session and the packet API's
own authorization. The sign-in adapter carries a validated relative return path
through the existing Base operator-auth flow.

Priority comes from actual `new_issue` and `regression` facts. The regression
release is the immutable accepted alert payload, never the newest received event.
The issue list and direct packet APIs include that fact per issue. Loading the
bounded project alert feed is not a prerequisite for issue priority or viewing.
The issue-list API orders active regressions, then active new issues, then other
groups before its 100-group limit, breaking ties by latest receipt and issue ID.
Client search, filters, sorting and 25-group pages work within that selection.
The list and navigation unseen counts cover only the loaded selection before
filters or pagination; neither claims a project-wide unseen total.
Unseen means the latest relevant alert for an active issue has not been viewed in
this browser. Loading that issue's packet marks it viewed; loading a list or alert
feed does not. Browser storage keeps only alert IDs and does not evict previously
viewed facts merely because other issues were opened.
Unavailable browser storage keeps viewing for this session. No shared/team read
status or acknowledgement is implied. Resolving or suppressing removes the active
attention badge; a later genuine regression supplies a new unseen alert.

Each explicit Upload map action has a unique request identity. The draft keeps
its consumed request and return issue across navigation; a new request cannot
overwrite edited fields or a selected file without explicit replacement.

`Details` uses a modal native dialog: heading focus, contained Tab/Shift+Tab,
Escape close and trigger focus return. Children stay mounted so closing does not
discard drafts. Exact IDs, grouping algorithms, receipt snapshots and raw JSON
remain there. Original source coordinates lead every mapped stack frame. A frame
without an actual mapped result continues to say Generated source.

Styling follows the Spool style (11 Oct 2026): tokens, type and shared components
are defined once in `public/theme/spool.css`, which the workbench, the sign-in
document, the landing and the docs pages all link. `shell.css` holds the sidebar,
header and evidence rail. The rail is rendered by the issue view right after the
stack trace: beside it on wide screens, under it on narrow ones. `views.css` holds
the work views. At
phone width the navigation folds behind a Menu button and table rows become cards,
with 25 groups per page.
