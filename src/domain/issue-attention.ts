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
// retained events that carried the count.
export const clientDroppedSql = `(SELECT COALESCE(SUM(json_extract(e.payload,'$.dropped')),0) FROM events e WHERE e.project=i.project AND e.issue=i.id) client_dropped`;
