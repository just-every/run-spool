// Connection status is temporary metadata, separate from loss/billing receipts.
export function rememberCaptureSource(db: D1Database, project: string, origin: string | undefined, time: number) {
 const minute = Math.floor(time / 60000) * 60000;
 return [
  db.prepare('DELETE FROM capture_sources WHERE project=? AND window<?').bind(project, minute - 3600000),
  db.prepare('INSERT INTO capture_sources VALUES(?,?,?,1) ON CONFLICT(project,window,origin) DO UPDATE SET count=count+1').bind(project, minute, origin ?? ''),
 ];
}

export async function recentCapture(db: D1Database, project: string, time: number) {
 const since = Math.ceil((time - 3600000) / 60000) * 60000;
 const [accepted, sources] = await Promise.all([
  db.prepare("SELECT COALESCE(SUM(count),0) count FROM outcomes WHERE project=? AND window>=? AND reason='accepted'").bind(project, since).first<{ count: number }>(),
  db.prepare('SELECT origin,SUM(count) count FROM capture_sources WHERE project=? AND window>=? GROUP BY origin ORDER BY origin').bind(project, since).all<{ origin: string; count: number }>(),
 ]);
 return { count: accepted?.count ?? 0, sources: sources.results.map(row => ({ origin: row.origin || null, count: row.count })) };
}
