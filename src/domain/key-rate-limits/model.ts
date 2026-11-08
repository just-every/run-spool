// Both counters follow UTC buckets and survive configuration changes and restart.
// Keep one row per key; filtered, duplicate and refused events never spend it.
const epoch = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
export const bucketSql = (seconds: number) => `CAST(${epoch}/${seconds * 1000} AS INTEGER)*${seconds * 1000}`;
export const keyRateTables = ['key_rate_limits', 'key_rate_usage'];
export function spendKeyEvent(db: D1Database, project: string, key: string) {
 return db.prepare(`INSERT INTO key_rate_usage(project,key_hash,minute_start,minute_count,hour_start,hour_count)
  VALUES(?,?,${bucketSql(60)},1,${bucketSql(3600)},1)
  ON CONFLICT(project,key_hash) DO UPDATE SET
   minute_count=CASE WHEN minute_start=excluded.minute_start THEN minute_count+1 ELSE 1 END,
   hour_count=CASE WHEN hour_start=excluded.hour_start THEN hour_count+1 ELSE 1 END,
   minute_start=excluded.minute_start,hour_start=excluded.hour_start`).bind(project,key);
}
export async function readKeyRate(db: D1Database, project: string, key: string) {
 const config = await db.prepare('SELECT revision,event_limit,period_seconds FROM key_rate_limits WHERE project=? AND key_hash=?').bind(project,key).first<{revision:number;event_limit:number|null;period_seconds:number}>();
 const usage = await db.prepare(`SELECT CASE WHEN minute_start=${bucketSql(60)} THEN minute_count ELSE 0 END minute,
  CASE WHEN hour_start=${bucketSql(3600)} THEN hour_count ELSE 0 END hour,
  CAST((${epoch})/1000 AS INTEGER) now FROM key_rate_usage WHERE project=? AND key_hash=?`).bind(project,key).first<{minute:number;hour:number;now:number}>();
 const period = config?.period_seconds ?? 60, used = (period===60?usage?.minute:usage?.hour) ?? 0;
 return { revision:config?.revision??0, limit:config?.event_limit??null, period:period===60?'minute':'hour', used,
  retryAfter:Math.max(1,Math.min(period,period-((usage?.now??Math.floor(Date.now()/1000))%period))) };
}
export async function keyLimitedResponse(c: any, scope: {project:string;keyHash:string}) {
 const {retryAfter}=await readKeyRate(c.env.DB,scope.project,scope.keyHash);
 c.header('Retry-After',String(retryAfter));
 c.header('X-Sentry-Rate-Limits',`${retryAfter}:error:project:key_rate_limited`);
 c.header('X-Sentry-Error','key_rate_limited');
 return c.json({outcome:'dropped',reason:'key_rate_limited',retryAfter},429);
}
