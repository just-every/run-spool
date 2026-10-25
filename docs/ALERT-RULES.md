# Alert rules

The owner configures rules in Alerts → Rules. New issue, regression and reactivation rules route accepted transitions; a plain Resolve regresses on the next accepted event, in the same release or with no release. Window rules evaluate complete aligned windows and retain fired and withheld decisions.

Filters select environment, severity, a named release or no release, and exact values for owner-approved tag keys. The same filters run in preview and admission. Session percentage supports environment and release because sessions do not carry event severity or tags.

Affected users are distinct retained SDK-008 user keys. Events without a key are named and counted separately. A user condition is refused when policy drops all keys or no retained key exists. Session percentage uses observed SDK-005 individual and aggregate sessions: affected sessions divided by all observed sessions in the window. No session data means refusal, not zero. Session percentage currently needs a matching retained issue to anchor its alert.

## Preview and enabling

Preview shows retained matches, transitions and their windows, the installation owner and destination. It samples at most 100 retained issue/windows over 90 days and names this coverage bound. Enabling requires the exact reviewed draft and current identity-policy revision. Any edit or policy revision invalidates the preview. Enabling starts future complete windows; history is never dispatched.

Rules and their filters travel in owner archives, disabled. Queues, previews, cursors and decision work records are operational and excluded. Fired decisions remain with safe historical alert payloads. Project and owner erasure remove configuration and operational stores.

## Historical baseline

Historical baseline compares an issue's sample-scaled share of accepted project event traffic with the matching window in the same hour of the week over eight previous weeks. SDK-supplied sample rates scale the observed counts; the decision shows the recorded rate and actual accepted traffic denominator. This is an event-traffic rate, not an inferred session or request rate.

At least two comparable windows and ten observed events per window are required. Recorded capture loss, client-report error discards and retention gaps exclude historical windows and are named. Current capture loss, low traffic, zero baseline or insufficient history withhold firing and retain the reason. A fixed occurrence threshold is labelled fixed threshold.

Alert and delivery identities bind the rule, revision, issue and window. Re-evaluation and restart cannot route the same transition twice. Team/priority filters, broader session crash-rate rules, transaction/span and web-vital metrics, and Sentry metric-rule migration remain outside this implementation.
