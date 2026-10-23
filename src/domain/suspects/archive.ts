import { scrub } from '../privacy';
export const suspectTables: Record<string, string[]> = { suspect_decisions: ['project','issue','release','sha','judgment','note','revision','updated','operator_id'] };
export const suspectDefaults = (data: any) => ({ suspect_decisions: [], ...data });
export function validateSuspectArchive(data: any) {
 const seen = new Set<string>();
 for (const row of data.suspect_decisions) {
  const key = JSON.stringify([row.project,row.issue,row.release,row.sha]);
  if (seen.has(key) || !data.issues.some((i: any) => i.project === row.project && i.id === row.issue) || !data.releases.some((r: any) => r.project === row.project && r.name === row.release) ||
   (row.sha !== '' && !data.release_commits.some((c: any) => c.project === row.project && c.release === row.release && c.sha === row.sha)) ||
   !['confirmed','rejected'].includes(row.judgment) || typeof row.note !== 'string' || !row.note.trim() || row.note.length > 600 || scrub(row.note) !== row.note ||
   !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.updated) || row.updated < 0 || typeof row.operator_id !== 'string' || !row.operator_id || row.operator_id.length > 150) throw new Error('Archive suspect judgment');
  seen.add(key);
 }
}
