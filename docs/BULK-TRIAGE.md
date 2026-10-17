# Bulk triage

Search Issues, select individual rows or Select this page, choose Acknowledge, Reopen or Resolve in current release, then Preview triage. Inspect the complete selection before applying. Changing filters or pages clears selection; this never selects unseen result pages.

Resolution uses each issue's current registered release sequence, matching the existing single-issue action. A later registered release can regress it. Plain Resolve and next/named-release resolution remain unavailable.

`POST /api/projects/:project/bulk-triage` accepts `issues: [{id, revision}]`, `state` (`open`, `acknowledged`, `resolved`) and `apply: false`. The response includes the exact preview token and selected records. Apply sends the same selection/action with `apply: true` and `preview`. Between 1 and 100 unique issues are supported; the UI selects at most the displayed page.

Preview makes no changes. Apply guards every selected project's revision, occurrence aggregate and release watermark before changing any row, then commits all state changes and individual triage audit records in one owner-authorized batch. A stale selection, wrong project or changed owner authority refuses the whole operation. Refresh and select again after a conflict. Read-only, ingest and deploy grants cannot authorize this endpoint.

The existing archive and project/owner erasure custody cover the unchanged issue and triage-audit stores. Membership, comments, mentions, member assignment and priority remain separate work.
