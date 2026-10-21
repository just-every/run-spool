import { isShortId, normalizeShortId } from './format';
import { ensureShortIds } from './assign';

/** An issue shows the first ID it was given that still resolves to it, else its first ID
 * (merged into another issue). Aliases are the other IDs that resolve to it. */
export const primaryShortIdSql = (issue: string) => `COALESCE(
 (SELECT short_id FROM issue_short_ids WHERE project=${issue}.project AND assigned=${issue}.id AND issue=${issue}.id ORDER BY number LIMIT 1),
 (SELECT short_id FROM issue_short_ids WHERE project=${issue}.project AND assigned=${issue}.id ORDER BY number LIMIT 1))`;
export const shortIdColumnsSql = (issue = 'i') => `${primaryShortIdSql(issue)} short_id,
 (SELECT json_group_array(short_id) FROM (SELECT short_id FROM issue_short_ids WHERE project=${issue}.project AND issue=${issue}.id AND short_id IS NOT ${primaryShortIdSql(issue)} ORDER BY number)) short_id_aliases,
 (SELECT ${primaryShortIdSql('target')} FROM issue_short_ids moved JOIN issues target ON target.id=moved.issue AND target.project=moved.project WHERE moved.short_id=${primaryShortIdSql(issue)} AND moved.issue<>${issue}.id) short_id_resolves_to`;
export function decodeShortIds<T extends Record<string, any>>(row: T) {
 let aliases: unknown = [];
 try { aliases = JSON.parse(row.short_id_aliases ?? '[]'); } catch { /* none */ }
 return { ...row, short_id: row.short_id ?? null, short_id_aliases: Array.isArray(aliases) ? aliases.filter(value => typeof value === 'string') : [], short_id_resolves_to: row.short_id_resolves_to ?? null };
}
/** An issue argument is its stored identity or any short ID/alias of this project, in any case. */
export async function resolveIssue(db: D1Database, project: string, value: string): Promise<{ issue: string; requested?: { id: string; shortId: string; alias: boolean } } | null> {
 if (/^[a-f0-9]{64}$/.test(value)) return { issue: value };
 if (!isShortId(value)) return null;
 await ensureShortIds(db, project);
 const row = await db.prepare(`SELECT s.issue,s.short_id,s.short_id<>${primaryShortIdSql('i')} alias FROM issue_short_ids s JOIN issues i ON i.id=s.issue AND i.project=s.project WHERE s.short_id=? AND s.project=?`).bind(normalizeShortId(value), project).first<{ issue: string; short_id: string; alias: number }>();
 return row ? { issue: row.issue, requested: { id: value, shortId: row.short_id, alias: row.alias === 1 } } : null;
}
