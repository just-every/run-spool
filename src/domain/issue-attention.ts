// Issue attention is independent of the bounded project activity feed. Read the
// accepted alert payload, never the release of a later ordinary occurrence.
export const issueAttentionSql = `(SELECT json_object(
  'id',a.id,'issue',a.issue,'kind',a.kind,'created',a.created,'payload',json(a.payload))
  FROM alerts a WHERE a.project=i.project AND a.issue=i.id
    AND a.kind IN ('new_issue','regression') AND i.state NOT IN ('resolved','suppressed')
  ORDER BY a.created DESC,COALESCE(json_extract(a.payload,'$.release.sequence'),0) DESC,a.id DESC
  LIMIT 1) attention`;

export function decodeIssueAttention<T extends { attention: string | null }>(issue: T) {
  return { ...issue, attention: issue.attention ? JSON.parse(issue.attention) : null };
}

// Errors the SDK counted at an issue's location but did not send (its per-location cap or a repeat), as reported on the
// retained events that carried the count. Event triggers keep the tally (migration 0121).
export const clientDroppedSql = `COALESCE((SELECT d.dropped FROM issue_client_drops d WHERE d.project=i.project AND d.issue=i.id),0) client_dropped`;

// Native empty aggregates keep correction provenance but are not triage work.
// Imported issue-only exports remain inspectable even without collected events.
export const listedIssueSql = (alias='i') =>
 `(${alias}.count>0 OR ${alias}.algorithm IN ('sentry-import-v1','rollbar-import-v1'))`;
