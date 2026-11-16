# User identity policy

New projects keep the user ID, email, username and IP address sent by the SDK, subject to installation scrubbing rules. The creation form states this policy before you create a project. Other user fields remain excluded, and automatic IP detection is unavailable. Existing projects, restored projects and saved drop choices keep their policy; this change does not recover or relax them. Impact by user is unavailable when the policy drops identity; it is not a count of zero users.

Implementation note — Run Edit Run fleet, 15 November 2026: this default applies only to newly created projects. A dedicated organization identity floor and imported Sentry identity settings remain outside the implemented policy surface; the existing installation scrubbing floor continues to run before identity persistence.

## Change the policy

1. Create the project, then open **Settings** for that project.
2. Find **User identity policy**. Choose **drop**, **hash** or **keep** separately for User ID, User email, User username and User IP address.
3. Choose **Preview identity policy** and review the retained-event, identity-record and affected-user counts.
4. Choose **Save identity policy**. Later intake uses the saved policy. Existing retained values convert only toward stricter storage: keep to hash to drop. Keeping a field later cannot recover values already dropped.

**Keep** retains the selected value in this installation for permitted identity reads and private archives. **Hash** retains a keyed project hash, so equal values can count as one user without storing the original. **Drop** never stores that field. Other Sentry user fields remain dropped. Automatic IP detection is unavailable; Spool does not trust forwarded IP addresses. Session identifiers are stored as private project hashes.

The user key uses the first retained `id`, `email`, `username` or `ip_address`, in that order. A hash counts as itself and a dropped field is skipped. If the SDK sent no usable identity, the impact figure also stays unavailable. Agent packets and read-only grants receive counts only.

The project form links here before creation. Configuration remains under Settings, after the project exists. Changing this policy does not change the separate server scrubbing rules, and does not recover past identity or promise complete user search or end-user erasure.

## Erase one retained user

Run Edit Run fleet, 16 November 2026: **Settings → End-user erasure** now
previews an exact email, user ID, username or literal IP address under the
retained keep/hash policy. Previewing shows counts only and does not erase.
The installation owner chooses **Remove identity; keep events** or **Delete
matching events**, reviews the counts and limitations, then types
`ERASE USER DATA` and selects **Confirm user erasure**. Project maintainers
and administrators may preview; this destructive door requires the installation
owner. A changed preview must be read and confirmed again.

Identity removal clears all four retained user fields and the derived user key
on each matching event. Other users and other projects stay intact. Event
deletion also removes exact occurrence children, including attached feedback.
Individual sessions are de-identified only when their privately hashed DID is
literally equal to the supplied value; Spool cannot infer relationships between
different aliases or attribute anonymous aggregate sessions. Feedback contact is
already discarded at intake; scrubbed feedback messages have no independent
user index. Attachments, replays and identity search indexes/facets have no
retained matching store. The preview and receipt state those limitations rather
than claiming zero matches or complete erasure of those stores.

The completed receipt contains counts, times and retained-scope explanations.
The safe audit records completion without the supplied value or private hash.
The same atomic owner transaction invalidates pending archive copies and
advances the ERASE-001 portability redaction checkpoint. Later identity reads
and private archives omit the removed fields. This installation, or a fresh
installation given its later archive/journal, refuses a pre-erasure archive.
An empty installation given only an old archive cannot know about a later
erasure. Downloaded copies, provider backups and future captures are outside
this operation. This is not a promise of complete SDK-027 acceptance: identity
search/facets and the public 150,000-event volume remain unavailable.
