import { ensureShortIds } from '../short-ids/assign';
import { shortIdColumnsSql, decodeShortIds } from '../short-ids/lookup';
import { readGroupingPolicy } from './policy';

/** Applied agent rules affect future intake. Offer retained old groups for explicit review only. */
export async function ruleMergeSuggestions(db: D1Database, project: string, source?: string) {
  const active = await readGroupingPolicy(db, project);
  if (!active.revision) return [];
  const proposals = await db.prepare("SELECT explanation FROM grouping_proposals WHERE project=? AND kind='rule' AND state='applied' AND rule_revision=?").bind(project,active.revision).all<{explanation:string}>();
  const candidates = new Map<string,{source:string; target:string; events:Set<string>}>();
  for (const row of proposals.results) for (const move of JSON.parse(row.explanation).affected ?? []) {
    if (move.from === move.to || source && move.from !== source) continue;
    const key = JSON.stringify([move.from,move.to]);
    const candidate = candidates.get(key) ?? {source:move.from,target:move.to,events:new Set<string>()};
    candidate.events.add(move.event); candidates.set(key,candidate);
  }
  if (!candidates.size) return [];
  await ensureShortIds(db,project);
  const ids = [...new Set([...candidates.values()].flatMap(row=>[row.source,row.target]))];
  const issues = (await db.prepare(`SELECT i.*,${shortIdColumnsSql('i')} FROM issues i WHERE project=? AND id IN (SELECT value FROM json_each(?))`).bind(project,JSON.stringify(ids)).all<any>()).results.map(decodeShortIds);
  const result = [];
  for (const candidate of candidates.values()) {
    const from = issues.find(row=>row.id===candidate.source), to = issues.find(row=>row.id===candidate.target);
    if (!from || from.count < 1 || from.count > 200 || to && to.count < 1) continue;
    const retained = await db.prepare('SELECT COUNT(*) count FROM events WHERE project=? AND issue=? AND historical=0 AND id IN (SELECT value FROM json_each(?))').bind(project,from.id,JSON.stringify([...candidate.events])).first<{count:number}>();
    // Do not offer a whole-group merge if only part of the old group matched the rule.
    if (retained?.count !== from.count) continue;
    const view = (row:any) => ({id:row.id,short_id:row.short_id,title:row.title,count:row.count,revision:row.revision});
    result.push({source:view(from),target:to?view(to):null,ruleRevision:active.revision});
  }
  return result;
}
