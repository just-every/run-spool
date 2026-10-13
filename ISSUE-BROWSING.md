# Spool issue browsing

This followup implements the first-release requirement to list real stored issue groups as a dedicated view using the original approved issues design. It adds no ingestion protocol, grouping or schema change. The selected issue workbench remains available.

Acceptance: show actual group title/identity, supported triage state, retained occurrence count and historical first/last received timestamps; open a row's exact evidence; search title/ID and filter triage locally; distinguish loading, empty project and no matching rows; preserve keyboard/reflow access. Search and counts apply only to the latest100 groups returned by the existing scoped API. At100 rows, explicitly state that older groups may be omitted. No complete installation total, unique-user count, deployment proof or verified repair is inferred. Retention may remove occurrence evidence while leaving a zero-count historical group.

Later server pagination and server-side search require separate API/ordering acceptance. This slice does not present local filters as an exhaustive project search. The approved raster and completed12ui issue kit remain reference assets; actual data and accessible controls determine the content.
