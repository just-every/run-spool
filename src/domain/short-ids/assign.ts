import { tombstone } from '../../modules/portability/journal.mjs';
import { base32Sql, prefixBase } from './format';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
/** The next number becomes this issue's short ID unless an ID already resolves to it.
 * A merged-away issue that captures again therefore gets a fresh ID; numbers never repeat. */
export function assignShortId(db: D1Database, project: string, issue: string, time: number) {
 return [
  s(db, `INSERT INTO issue_short_ids(short_id,project,issue,assigned,number,created) SELECT p.prefix||'-'||${base32Sql('p.next')},p.project,?,?,p.next,? FROM short_id_prefixes p
   WHERE p.project=? AND EXISTS(SELECT 1 FROM issues WHERE id=? AND project=?) AND NOT EXISTS(SELECT 1 FROM issue_short_ids WHERE project=? AND issue=?)`, issue, issue, time, project, issue, project, project, issue),
  s(db, 'UPDATE short_id_prefixes SET next=next+1 WHERE project=? AND changes()=1', project),
 ];
}
/** An erased project's prefix stays retired: its portability tombstone remains. */
async function retired(db: D1Database, prefix: string) {
 const sources = (await db.prepare('SELECT DISTINCT source FROM rer_portability_journal').all<{ source: string }>()).results;
 if (!sources.length) return false;
 const hashes = await Promise.all(sources.map(({ source }) => tombstone(source, 'short_id_prefixes', { prefix })));
 return !!await db.prepare('SELECT 1 FROM rer_portability_journal WHERE tombstone IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(hashes)).first();
}
/** A new project's prefix: its base, else `<base>_2`, `<base>_3`… never a live or retired one. */
export async function projectPrefix(db: D1Database, project: string) {
 const base = prefixBase(project);
 for (let n = 1; ; n++) {
  const prefix = n === 1 ? base : `${base}_${n}`;
  if (!await db.prepare('SELECT 1 FROM short_id_prefixes WHERE prefix=?').bind(prefix).first() && !await retired(db, prefix)) return prefix;
 }
}
export const prefixStatement = (db: D1Database, prefix: string, project: string, time: number) =>
 s(db, 'INSERT INTO short_id_prefixes(prefix,project,next,created) SELECT ?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM short_id_prefixes WHERE prefix=? OR project=?)', prefix, project, time, prefix, project);

/** Restored, imported and demo issues arrive without short IDs. Projects take a
 * prefix in creation order and issues a number in first-seen order, exactly as
 * migration 0059 numbered existing data, so a restore of an older archive yields
 * the IDs its upgraded source holds. Rows of issues an import undo removed go. */
export async function ensureShortIds(db: D1Database, project?: string) {
 const scope = project === undefined ? '' : ' AND i.project=?', args = project === undefined ? [] : [project];
 const projects = (await db.prepare(`SELECT id,created FROM projects i WHERE NOT EXISTS(SELECT 1 FROM short_id_prefixes p WHERE p.project=i.id)${project === undefined ? '' : ' AND i.id=?'} ORDER BY created,id`).bind(...args).all<{ id: string; created: number }>()).results;
 const missing = await db.prepare(`SELECT 1 FROM issues i WHERE NOT EXISTS(SELECT 1 FROM issue_short_ids s WHERE s.project=i.project AND s.assigned=i.id)${scope} LIMIT 1`).bind(...args).first();
 const dangling = await db.prepare('SELECT 1 FROM issue_short_ids s WHERE NOT EXISTS(SELECT 1 FROM issues i WHERE i.id=s.assigned AND i.project=s.project) LIMIT 1').first();
 if (!projects.length && !missing && !dangling) return;
 for (const row of projects) await prefixStatement(db, await projectPrefix(db, row.id), row.id, row.created).run();
 await db.batch([
  s(db, 'DELETE FROM issue_short_id_moves WHERE short_id IN (SELECT short_id FROM issue_short_ids s WHERE NOT EXISTS(SELECT 1 FROM issues i WHERE i.id=s.assigned AND i.project=s.project))'),
  s(db, 'DELETE FROM issue_short_ids WHERE NOT EXISTS(SELECT 1 FROM issues i WHERE i.id=issue_short_ids.assigned AND i.project=issue_short_ids.project)'),
  s(db, 'DELETE FROM short_id_prefixes WHERE NOT EXISTS(SELECT 1 FROM projects WHERE id=short_id_prefixes.project)'),
  s(db, `INSERT INTO issue_short_ids(short_id,project,issue,assigned,number,created)
   SELECT p.prefix||'-'||${base32Sql('p.next+m.n-1')},m.project,m.id,m.id,p.next+m.n-1,m.first_seen FROM (
    SELECT i.id,i.project,i.first_seen,ROW_NUMBER() OVER (PARTITION BY i.project ORDER BY i.first_seen,i.id) n FROM issues i
    WHERE NOT EXISTS(SELECT 1 FROM issue_short_ids s WHERE s.project=i.project AND s.assigned=i.id)${scope}) m JOIN short_id_prefixes p ON p.project=m.project`, ...args),
  s(db, 'UPDATE short_id_prefixes SET next=MAX(next,COALESCE((SELECT MAX(number) FROM issue_short_ids WHERE project=short_id_prefixes.project),0)+1)'),
 ]);
}
