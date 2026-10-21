# Investigating an issue

Open **Issues** to load up to 100 retained groups for the selected project.
Active regressions are selected first, then active new issues, then other groups,
with the most recently received first within each priority. More groups may exist.
The list has 25 groups per page, status and release filters, search, and a choice
of priority, latest receipt, or occurrence count. These controls apply only to the
loaded selection. Occurrence counts include retained events, not people affected.

New issues and genuine regressions have visible badges. With **Priority first**
selected, unseen alerts sort first within the loaded groups, with regressions
before new issues within each viewing status. Opening an issue and successfully
loading its evidence marks its current alert as viewed in this browser. Opening
the list or alert feed does not. List and navigation unseen counts cover only the
loaded selection before filters and pagination; they are not project-wide totals.
Viewing state is local to this browser and is retained when browser storage is
available; without storage it lasts for this session.
Viewing does not acknowledge or resolve an issue. A resolved or suppressed issue
has no active attention badge.

Each issue response includes its latest new or regression fact, independently of
the 100-entry alert feed. Later spike alerts cannot remove that issue's badge or
change whether it has been viewed. Direct issue URLs carry the same fact.

A regression is a resolved issue accepted in a later registered release. The
badge names the release saved in that alert, so an older release arriving later
cannot relabel it. Register releases in the order used for comparison. Registering
a release does not prove that it was deployed.

An issue URL identifies its project and group, for example
`/projects/storefront/issues/<issue-id>`. **Copy link** copies that destination.
Every issue also has a short ID such as `STOREFRONT-1A3`, shown in the list and
on the issue: search for it, or open `/projects/storefront/issues/STOREFRONT-1A3`.
After a merge the absorbed issue's short ID opens the surviving issue. A commit
whose message says `Fixes STOREFRONT-1A3`, registered with a release, links here
and resolves the issue in that release ([short IDs and commits](SHORT-IDS.md)).
Refresh and browser Back/Forward preserve it. Anyone opening it needs the owner
session for this installation; sign-in returns to the requested page. A project
read grant reads API evidence and does not grant owner access to the UI.

Mapped stacks put the original file, line and column first. **Generated source**
means no original position was found for that frame. One missing-map message leads
to **Upload map**, with the occurrence's release and known debug ID selected.
Maps must also match the exact build. Adding a map enriches current lookup without
rewriting the event's original receipt. **Details** retains the exact generated
frames, IDs and diagnostics; Escape closes Details and returns keyboard focus.

**Resolved** records your decision. A quiet feed cannot prove that a repair worked
or that every error was captured. The issue's evidence packet excludes credentials
and source contents, but review its remaining free text for personal data before
sharing it.

In **Capture**, the installation snippet includes the absolute address of this
Spool service. Download the helper into your application's bundle, allow that
application's exact browser origin, and use its project key and registered release.
Trigger an error in that application and choose **Check for events**. A new project
shows a waiting state until an event is accepted. Recorded attempts with no
accepted event show that state explicitly; inspect Capture receipts for the
actual reason and available repair action. A retained old issue is not evidence
of recent accepted capture.

Form drafts and selected upload contents stay in memory while moving within the
app. They are cleared by reload, sign-out or session expiry; they are not saved to
the server merely because a form was filled.
Returning to a contextual source-map upload keeps its edited release, debug ID
and selected file. Choosing Upload map on another issue offers to keep the draft
or explicitly replace it; replacement clears the old file. Registering a release
also preserves an edited map draft.
