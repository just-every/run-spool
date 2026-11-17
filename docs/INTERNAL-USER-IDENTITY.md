# Internal identity implementation notes

sd, 2026-11-17T14:46:40Z. Moved from the product help page so implementation history remains available to maintainers.


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
user index. Attachments and replays have no retained matching store. The preview and receipt state those limitations rather
than claiming zero matches or complete erasure of those stores.

The completed receipt contains counts, times and retained-scope explanations.
The safe audit records completion without the supplied value or private hash.
The same atomic owner transaction invalidates pending archive copies and
advances the ERASE-001 portability redaction checkpoint. Later identity reads
and private archives omit the removed fields. This installation, or a fresh
installation given its later archive/journal, refuses a pre-erasure archive.
An empty installation given only an old archive cannot know about a later
erasure. Downloaded copies, provider backups and future captures are outside
this operation. Complete SDK-027 acceptance, including independently matching feedback and
unsupported captured copies, remains unproven. The scale journey below separately
qualifies the admitted-volume timing when it passes on the candidate.

### Identity search and facets

Run Edit Run fleet (sd), 16 November 2026: the installation owner can read
`GET /api/projects/<project>/identity-search`. Its count, first 25 occurrence
references and first 1,000 facet values come directly from the retained identity
projection. The response names truncation. Add `field=user.email&value=<value>`
to find an exact email; `user.id`, `user.username`, `user.ip` and `ip_address`
are also supported. A raw supplied value matches its project hash under hash
policy. A stored hash can also be searched directly. Facet values are raw only
under keep, hashed under hash, and absent under drop. Private match hashes for
keep fields and the project key never enter this response.

This focused API is owner-only. Agent grants, members and administrators do not
inherit access; ordinary issue-search syntax still does not support `user.*`.
No additional identity index or persistent query is created. Erasure clears the
same projection, so both raw-input and stored-hash queries and their facets lose
the erased identity while other users and projects remain. The existing
ordinary search, issue export and tag facets read the changed event payloads.

### Captured copies and remaining stores

Run Edit Run fleet (sd), 16 November 2026: erasure now also scans project events
for exact retained identity copies in messages, tags and breadcrumbs, including
copies on occurrences with no retained identity. It recognizes the supplied
value and its private project hash, the matched occurrences' retained values
and hashes, and raw tag values whose project hash matches those aliases. Whole
tag entries are removed for exact matches; complete tokens inside captured
sentences are removed without changing neighboring text. Matching issue title
text and its retained attention-alert title copy are removed too. Digests are recomputed and previous occurrence/digest and
issue revision/title guards commit with identity removal, the receipt and one
existing portability redaction checkpoint in the same owner transaction.

The preview and receipt separately count changed text events, issue titles and alert titles.
A substring inside a longer identifier cannot be attributed safely. Text used
by an immutable grouping key cannot be removed by this door without changing
its provenance and breaking restore; those event payloads remain intact and
are explicitly counted in the preview and explained in the receipt. Identity
removal still completes, and the owner can instead choose to delete the exact
identity-matched events. Unknown aliases, encoded text, exception/stack/context
copies and independent derived snapshots remain outside this focused matcher.
An absence claim applies only to the supported copies actually removed.

Individual session DIDs still match only literal equality with the supplied
value. Anonymous aggregates, discarded aliases and absent attachment/replay
stores cannot be correlated. Feedback matching awaits its separate round.
Downloaded copies and future captures remain outside this installation.

### Performance and volume boundary

Run Edit Run fleet (sd), 17 November 2026: see [measured erasure and archive results](OWNER-ERASURE.md#measured-end-user-erasure-and-archive-results) for the prior candidate's 150,000-event erasure and 160,000-event archive proof.

Run Edit Run fleet (sd), 16 November 2026: bounded JSON batches use an indexed
occurrence lookup for each changed row. The JSON rows run first in each guard,
avoiding a full project scan and JSON reparse for every chunk. Payload and
identity updates, transfer invalidation, one journal checkpoint, audit and
receipt retain their existing atomic semantics; there is no per-event round
trip or journal entry.

Run Edit Run fleet (sd), 16 November 2026: archive validation now admits up to
160,000 events per project, including the 150,000-event erasure corpus. The old
10,000-event archive budget contradicted GOV-003's published volume and its
160,000-event archive/restore acceptance; it was a product validator limit, not
a fixture restriction. Native legacy archives admit the same event corpus;
other legacy table budgets and all payload, origin, schema, checksum, grouping,
identity and erasure-fence checks remain. Exact occurrence membership is indexed
in memory during identity validation instead of scanning all events per identity.
The 160,000-event budget is still a bounded implementation limit, not completion
of GOV-003's unlimited-retention target. Public intake keeps its separate current
capacity and minute limits.

Run the committed scale journey outside push Verify with a 2,400-second hard
alarm: `perl -e 'alarm 2400; exec @ARGV' -- node tests/end-user-erasure-volume.mjs`.
It requires public restore of all 150,000 events, reconciles issue and identity
counts, then checks owner-confirmed identity/tag/text removal within 300 seconds
while retaining every event. It records its checked-out candidate SHA, run ID,
client wall time and receipt time in `.artifacts/erasure-preview/volume.json`.
No smaller-corpus fallback can pass. The same journey's `--archive-160000` mode
checks the 160,000-event restore/archive counts and an unchanged empty destination
after an over-budget refusal. That capacity refusal is distinct from SDK-027's
older-archive `erasure_epoch` refusal, still checked by the public erasure journey.
