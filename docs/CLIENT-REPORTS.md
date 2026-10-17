# SDK discard reports

Sentry SDK `client_report` envelope items record quantities discarded before transport, grouped by their data category and reason. Capture receipts shows these separately from server admission and accepted event counts. Report-only envelopes need no release and create no issue, occurrence, release or alert. Their quantities do not consume the existing error admission budget.

The normal exact-project ingest grant, browser-origin policy and atomic authority fences apply. Complete envelope framing is checked before any item is persisted. A malformed client report is counted as `client_report_invalid` and contributes none of its partial quantities; a valid companion error is still processed. Protocol reason/category values must be bounded, scrub-invariant lowercase tokens and quantities positive safe integers within the report bound. Unknown safe SDK tokens remain visible rather than silently disappearing. No report text or arbitrary metadata is retained.

The response includes `clientReports` counts and `client_discarded:<category>:<reason>` quantities, and outcomes expose them over the server's 24-hour receipt window. The SDK timestamp does not rewrite server receipt time. Reports have no protocol retry identity: repeated transmissions add quantities again, so Spool reports received SDK claims rather than independently measured loss or a complete denominator.

Reported `error` discards join windowed repair and exposure-loss evidence. They make a quiet repair observation inconclusive. Discarded transactions and other categories do not imply lost error events. Unreported client loss remains unknown.

Existing outcomes archive/restore, retention and project erasure custody apply; archives validate the same bounded reason tokens. Spool's own SDK loss-report transport, full category budgets, sessions and complete runtime qualification remain separate gaps.

The real Node SDK public flush path is tested. Automatic browser and mobile lifecycle report delivery remain unqualified.
