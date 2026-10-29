import { hash } from '../privacy';
import { recordParameters, recordFilter, recordCursor, nextRecordCursor } from '../investigation/record-page';

export async function sessionRecords(c: any) {
 const project = c.req.param('project'), url = new URL(c.req.url);
 const { order, direction, comparison } = recordParameters(url, ['order', 'cursor', 'release', 'environment', 'kind', 'from', 'to']);
 const release = recordFilter(url.searchParams.get('release'), 200), environment = recordFilter(url.searchParams.get('environment'), 100);
 const kind = url.searchParams.get('kind') ?? 'all';
 if (!['all', 'individual', 'aggregate'].includes(kind)) throw new Error('Session kind must be all, individual or aggregate');
 const time = (name: string) => {
  const value = url.searchParams.get(name);
  if (value === null) return null;
  if (!/^\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid session record window');
  return Number(value);
 };
 const from = time('from'), to = time('to');
 if (from !== null && to !== null && to <= from) throw new Error('Invalid session record window');
 const signature = await hash(JSON.stringify(['session-records-v1', project, release, environment, kind, from, to, order]));
 const cursor = recordCursor(c.req.query('cursor'), signature);
 const where = 'project=?' + (release === null ? '' : ' AND release=?') + (environment === null ? '' : ' AND environment=?') + (from === null ? '' : ' AND started>=?') + (to === null ? '' : ' AND started<?');
 const args = [project, ...release === null ? [] : [release], ...environment === null ? [] : [environment], ...from === null ? [] : [from], ...to === null ? [] : [to]];
 // Select only the public projection: neither identity hashes nor private keys enter the query result.
 const individual = `SELECT json_array('individual',sid) id,'individual' kind,sid,release,environment,started,updated,status,errors,1 quantity FROM health_sessions WHERE ${where}`;
 const aggregate = `SELECT json_array('aggregate',release,environment,started,status) id,'aggregate' kind,NULL sid,release,environment,started,NULL updated,status,NULL errors,quantity FROM health_aggregates WHERE ${where}`;
 const sources = kind === 'individual' ? [individual] : kind === 'aggregate' ? [aggregate] : [individual, aggregate];
 const bindings = sources.flatMap(() => args), source = `WITH records AS (${sources.join(' UNION ALL ')})`;
 const [page, total] = await Promise.all([
  c.env.DB.prepare(`${source} SELECT * FROM records${cursor ? ` WHERE (started,id)${comparison}(?,?)` : ''} ORDER BY started ${direction},id COLLATE BINARY ${direction} LIMIT 26`).bind(...bindings, ...cursor ? [cursor.time, cursor.id] : []).all(),
  c.env.DB.prepare(`${source} SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN kind='individual' THEN quantity ELSE 0 END),0) individualSessions,COALESCE(SUM(CASE WHEN kind='aggregate' THEN quantity ELSE 0 END),0) aggregateSessions FROM records`).bind(...bindings).first(),
 ]);
 const rows = page.results.slice(0, 25), last = rows[24];
 return c.json({ version: 1, project, rows, total: total.total, next: page.results.length > 25 ? nextRecordCursor(signature, last.started, last.id) : null,
  bounds: { pageSize: 25 }, order, filters: { release, environment, kind, from, to },
  quantities: { individualSessions: total.individualSessions, aggregateSessions: total.aggregateSessions, sessionsSeen: total.individualSessions + total.aggregateSessions },
  coverage: 'Retained individual session observations and aggregate status buckets. Total counts records; quantity counts sessions. Aggregate users and individual identity are excluded. SID updates replace observations; aggregate replay may add quantity. Cursors observe current retained data, not snapshots.' });
}
