export const priorities=['high','medium','low'] as const;
export const prioritySql=(alias='i')=>`COALESCE((SELECT COALESCE(p.manual,CASE p.automatic WHEN 3 THEN 'high' WHEN 2 THEN 'medium' ELSE 'low' END) FROM issue_priorities p WHERE p.project=${alias}.project AND p.issue=${alias}.id),'high')`;
export async function ensureIssuePriorities(db:D1Database){
 await db.batch([db.prepare(`INSERT OR IGNORE INTO issue_priorities
  SELECT i.project,i.id,CASE WHEN EXISTS(SELECT 1 FROM alerts a WHERE a.project=i.project AND a.issue=i.id AND a.kind IN ('regression','spike')) THEN 3
  ELSE COALESCE((SELECT MAX(CASE COALESCE(json_extract(e.payload,'$.sentry.level'),'error') WHEN 'fatal' THEN 3 WHEN 'error' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) FROM events e WHERE e.project=i.project AND e.issue=i.id),3) END,NULL FROM issues i`)]);
}
