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
