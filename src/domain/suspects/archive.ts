import { changedFiles, cohortDevices, cohortSystems } from './metadata';
import { scrub } from '../privacy';
export const comparisonTables = {suspect_commit_files:['project','sha','files','received'],health_session_cohorts:['project','sid','device','os']};
export const suspectTables: Record<string, string[]> = { ...comparisonTables, suspect_decisions: ['project','issue','release','sha','judgment','note','revision','updated','operator_id'] };
export const suspectDefaults = (data: any) => ({suspect_commit_files:[],health_session_cohorts:[], suspect_decisions: [], ...data });
export function validateSuspectArchive(data: any) {
 const seen = new Set<string>();
 for(const row of data.suspect_commit_files){
  const files=changedFiles(JSON.parse(row.files)),key=JSON.stringify(['files',row.project,row.sha]);
  if(!files || JSON.stringify(files)!==row.files || seen.has(key) || !data.commits.some((c:any)=>c.project===row.project&&c.sha===row.sha) || !Number.isSafeInteger(row.received) || row.received<0)throw new Error('Archive changed-file receipt');
  seen.add(key);
 }
 for(const row of data.health_session_cohorts){
  const key=JSON.stringify(['cohort',row.project,row.sid]);
  if(seen.has(key)||!data.health_sessions.some((s:any)=>s.project===row.project&&s.sid===row.sid)||!cohortDevices.includes(row.device)||!cohortSystems.includes(row.os))throw new Error('Archive session cohort');
  seen.add(key);
 }
 for (const row of data.suspect_decisions) {
  const key = JSON.stringify([row.project,row.issue,row.release,row.sha]);
  if (seen.has(key) || !data.issues.some((i: any) => i.project === row.project && i.id === row.issue) || !data.releases.some((r: any) => r.project === row.project && r.name === row.release) ||
   (row.sha !== '' && !data.release_commits.some((c: any) => c.project === row.project && c.release === row.release && c.sha === row.sha)) ||
   !['confirmed','rejected'].includes(row.judgment) || typeof row.note !== 'string' || !row.note.trim() || row.note.length > 600 || scrub(row.note) !== row.note ||
   !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.updated) || row.updated < 0 || typeof row.operator_id !== 'string' || !row.operator_id || row.operator_id.length > 150) throw new Error('Archive suspect judgment');
  seen.add(key);
 }
}
