import { mintedByCurrentPerson } from './credential-fence';

// Connection status is temporary metadata, separate from loss/billing receipts.
export function rememberCaptureSource(db: D1Database, project: string, origin: string | undefined, time: number) {
 const minute = Math.floor(time / 60000) * 60000;
 return [
  db.prepare('DELETE FROM capture_sources WHERE project=? AND window<?').bind(project, minute - 3600000),
  db.prepare('INSERT INTO capture_sources VALUES(?,?,?,1) ON CONFLICT(project,window,origin) DO UPDATE SET count=count+1').bind(project, minute, origin ?? ''),
 ];
}

export async function captureOutcomes(db: D1Database, project: string, time: number) {
 const since = Math.ceil((time - 3600000) / 60000) * 60000;
 const [keys, accepted, sources, outcomes] = await db.batch([
  db.prepare(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN revoked IS NULL AND ${mintedByCurrentPerson} THEN 1 ELSE 0 END),0) active FROM credentials WHERE project=? AND kind='ingest'`).bind(project),
  db.prepare("SELECT COALESCE(SUM(count),0) count FROM outcomes WHERE project=? AND window>=? AND reason='accepted'").bind(project, since),
  db.prepare('SELECT origin,SUM(count) count FROM capture_sources WHERE project=? AND window>=? GROUP BY origin ORDER BY origin').bind(project, since),
  db.prepare('SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? GROUP BY reason').bind(project, time - 86400000),
 ]);
 return {
  captureKeys: keys.results[0] as { total: number; active: number },
  recentCapture: {
   count: (accepted.results[0] as { count: number } | undefined)?.count ?? 0,
   sources: (sources.results as { origin: string; count: number }[]).map(row => ({ origin: row.origin || null, count: row.count })),
  },
  rows: outcomes.results as { reason: string; count: number }[],
 };
}
