# Text feedback

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

Only description text and the event reference are retained. Spool applies its text scrubber before storage and again on reads and exports. Names, email, URLs, user context and attachments are excluded. Free text may still contain personal information; review it before sharing. Contact, replies, screenshot review, Spool's own localized widget and general end-user identity erasure are not available yet.

Open an issue's **User feedback** panel to read reports linked to its retained occurrences. **Settings → Feedback inbox** includes every report for the project, including standalone reports and unavailable event references. Use **Load more feedback** to continue through the bounded pages. A report never links to another project's event. Association follows the original retained occurrence; an event ID reused after retention does not acquire the old report. Reports sent before their referenced event remain explicitly unlinked.

Choose **Withdraw feedback**, review the limits, then **Confirm withdrawal** to remove the description. Future exports omit it. The installation's portability journal refuses older archives containing the withdrawn report; a new installation needs the later archive or journal to recognize the withdrawal. Downloaded archives and external copies cannot be removed by this action.

Private archives include feedback. Historical archives restore the new collection empty. Project erasure removes it, and installation-owner erasure includes exact known owner identifiers in descriptions under the existing attribution rules. Retention removes linked feedback with its original occurrence and applies the cutoff to standalone reports.

The feedback inbox and withdrawal API require the current owner session. Ingest grants can submit reports only to their own project; agent and deploy grants cannot read them. The same browser Origin policy as Sentry error intake applies. Descriptions are limited to 1,000 characters, intake to 60 reports per project per minute and retained feedback to 1,000 reports per project. The inbox and API publish these bounds. Larger requests, invalid reports and exhausted budgets return explicit refusals; feedback does not consume accepted error units.

## Hosted crash-report dialog

The unmodified browser SDK's `Sentry.showReportDialog({eventId})`, including the official loader's queued stub, injects a cross-origin anonymous script request: `GET <DSN origin>/api/embed/error-page/?dsn=<DSN>&eventId=<32-hex event ID>` plus SDK dialog options. Spool answers GET and HEAD only for a valid enabled ingest key, the matching numeric project alias at the same origin, and enabled SDK-023 loader settings. Unknown, revoked, disabled, mismatched and malformed requests receive the same empty 404. Responses are never cached, carry `nosniff` and allow the script request across origins.

Spool's own modal asks for a description and explicit consent: “I consent to sharing this description and the error reference with this application’s team. Name and email are not kept.” It submits a legacy `user_report` to the same DSN envelope intake; the existing Origin rules, scrubber, 1,000-character limit, 60-per-project-per-minute limit, exact-occurrence association, withdrawal, retention, archive and erasure handling apply. Empty descriptions, absent consent, send failures and minute-limit refusals are visible. A successful send is acknowledged in the modal. Close and Escape restore focus and invoke the SDK close hook.

Only description text and the event reference enter feedback custody. The SDK sends name/email options in the script request URL, but Spool ignores them and exposes no such fields; avoid supplying personal options in the first place. Bounded wording overrides (`title`, `subtitle`, `labelComments`, `labelSubmit`, `labelClose`, `errorFormEntry`, `errorGeneric`, `successMessage`, each at most 240 characters) render as text. Contact/replies, screenshot/attachment review, Spool's independent localized widget and end-user identity erasure remain unavailable. Default ADOPTED: description-only qualifies this crash-report modal; contact remains a named gap.
