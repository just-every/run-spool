# Feedback and private review

Spool receives text descriptions from Sentry's `captureFeedback`, modern feedback items and legacy `user_report` items. A report can reference an existing event or arrive independently. Feedback does not create an error occurrence or an error alert, and does not require a registered release.

Obtain the affected user's consent in your application's form before sending. For an existing captured error:

```js
const eventId = Sentry.captureException(error);
await Sentry.flush(5000);
// After the user submits your consent form:
Sentry.captureFeedback({
  message: description,
  associatedEventId: eventId,
});
await Sentry.flush(5000);
```

Without the explicit consent extension below, only description text and the event reference are retained. Spool applies its text scrubber before storage and again on reads and exports. Names, email, URLs, user context and attachments are excluded. Free text may still contain personal information; review it before sharing. Spool's own localized widget and general end-user identity erasure remain incomplete.

Open an issue's **User feedback** panel to read reports linked to its retained occurrences. **Settings → Feedback inbox** includes every report for the project, including standalone reports and unavailable event references. Use **Load more feedback** to continue through the bounded pages. A report never links to another project's event. Association follows the original retained occurrence; an event ID reused after retention does not acquire the old report. Reports sent before their referenced event remain explicitly unlinked.

Choose **Withdraw feedback**, review the limits, then **Confirm withdrawal** to remove the description. Future exports omit it. The installation's portability journal refuses older archives containing the withdrawn report; a new installation needs the later archive or journal to recognize the withdrawal. Downloaded archives and external copies cannot be removed by this action.

Private archives include feedback. Historical archives restore the new collection empty. Project erasure removes it, and installation-owner erasure includes exact known owner identifiers in descriptions under the existing attribution rules. Retention removes linked feedback with its original occurrence and applies the cutoff to standalone reports.

The feedback inbox and withdrawal API require the current owner session. Ingest grants can submit reports only to their own project; agent and deploy grants cannot read them. The same browser Origin policy as Sentry error intake applies. Descriptions are limited to 1,000 characters, intake to 60 reports per project per minute and retained feedback to 1,000 reports per project. The inbox and API publish these bounds. Larger requests, invalid reports and exhausted budgets return explicit refusals; feedback does not consume accepted error units.

## Hosted crash-report dialog

The unmodified browser SDK's `Sentry.showReportDialog({eventId})`, including the official loader's queued stub, injects a cross-origin anonymous script request: `GET <DSN origin>/api/embed/error-page/?dsn=<DSN>&eventId=<32-hex event ID>` plus SDK dialog options. Spool answers GET and HEAD only for a valid enabled ingest key, the matching numeric project alias at the same origin, and enabled SDK-023 loader settings. Unknown, revoked, disabled, mismatched and malformed requests receive the same empty 404. Responses are never cached, carry `nosniff` and allow the script request across origins.

Spool's own modal asks for a description and explicit consent: “I consent to sharing this description and the error reference with this application’s team. Name and email are not kept.” It submits a legacy `user_report` to the same DSN envelope intake; the existing Origin rules, scrubber, 1,000-character limit, 60-per-project-per-minute limit, exact-occurrence association, withdrawal, retention, archive and erasure handling apply. Empty descriptions, absent consent, send failures and minute-limit refusals are visible. A successful send is acknowledged in the modal. Close and Escape restore focus and invoke the SDK close hook.

Only description text and the event reference enter feedback custody. The SDK sends name/email options in the script request URL, but Spool ignores them and exposes no such fields; avoid supplying personal options in the first place. Bounded wording overrides (`title`, `subtitle`, `labelComments`, `labelSubmit`, `labelClose`, `errorFormEntry`, `errorGeneric`, `successMessage`, each at most 240 characters) render as text. Contact/replies, screenshot/attachment review, Spool's independent localized widget and end-user identity erasure remain unavailable. Default ADOPTED: description-only qualifies this crash-report modal; contact remains a named gap.

For bounded read-only integrations, the separate version-1 `feedback-reports` API in [INVESTIGATION.md](INVESTIGATION.md) allows an exact-project agent/service grant to paginate scrubbed descriptions and association state. It confers no withdrawal or inbox/settings authority.

## Consented private details and replies

An application can add `contexts.feedback.spool` to a modern feedback payload
(or `spool` to a legacy `user_report`) **only after explicit consent**:

```js
spool: {
  consent: true,
  contactEmail: 'synthetic-spool-1@example.test', // optional
  screenshotPng: pngBase64, // optional, raw base64 PNG, no data URL
}
```

This opt-in extension is distinct from Sentry's ordinary `contact_email`, name,
URL and attachment fields, which remain discarded. The unchanged Sentry widget
and crash dialog retain their description-only path. No consent means no private
details. PNGs are bounded to 128 KiB and 4096 by 4096 pixels; only rendering
chunks survive, removing EXIF and text metadata. SVG, HTML and external image
URLs are refused. Pixels may still contain personal information: the reporter
must review them before submission. The inbox explains this again during review.

Open **Settings → Issue processing → Feedback inbox → Review report privately**.
Only the owner, organization administrators and assigned project members or
maintainers can open private review, see contact, review screenshots or reply.
Read-only members, unrelated teams, ingest/deploy/service/agent credentials and
unauthenticated callers cannot. Contact, screenshots and replies do not appear
in issue feedback or agent evidence. Screenshot bytes are fetched from the
session-authorized `feedback/:id/screenshot` route with `private, no-store`, PNG
content type, `nosniff`, same-origin resource policy and a sandbox policy. There
is no public URL. Review reads and changes are audited without private values.

**Mark report reviewed** records the review. **Send reply** is an explicit action
to the consented contact; it never sends automatically on intake or review. Each
reply records a queued, sent, failed or never-sent state. Sent means the configured
email provider accepted the message, not confirmed mailbox delivery. Uncertain
attempts show failed/delivery unconfirmed and are never replayed automatically.
A repeated request ID cannot send twice. Replies are scrubbed, bounded to 2,000
characters and capped at 20 per report. The shared approved mail sender handles
provider validation and the attempt audit. No provider credentials or raw
provider diagnostics enter feedback storage.

With `MAIL_PROVIDER=none`, the control says email is off and is disabled. The API
can record an explicit attempted reply as never sent (`mail_off`), without
constructing a remote sender. Local suppression and missing mail configuration
also record never sent, with their own reason. Tests use the existing provider
network fake, never a real provider.

Private details and the reply ledger share the feedback row, so withdrawal,
linked occurrence deletion, retention and complete project erasure remove them
with the report. Private installation archives retain the consented details and
ledger; restoring never queues a new send. The withdrawal journal and active
transfer invalidation fence older copies as for description text. Additive
migration 0109 preserves historical reports with no private details; prior
native archives translate that exact missing column to null.
Current archive rows without consent carry `private_data: null`, including
unmodified widget, `captureFeedback` and `user_report` submissions. This nullable
column stores no contact, URL, screenshot or other metadata without consent.
Archives without a migration list can also declare the current private column;
restore checks their complete inventory before preserving it.

DEFAULT SDK-004: explicit consent, deny by default, owner and assigned project
team review only, no automatic outbound action, audited changes; private details
are not issue evidence. Organization administrators retain their existing
project authority and private archive authority.
GAP SDK-004: unmodified Sentry attachment intake, the independent Spanish
widget, broader abuse policy and identity-based selective erasure are not proven.
The parallel erasure round needs to match `feedback.private_data` contact and
reply text, then remove the whole feedback row under its existing custody fence;
this round does not edit `src/domain/erasure` or `src/domain/identities`.

Signed: Run Edit Run fleet, 2026-11-16 (UTC).
