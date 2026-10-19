import { readReleasePolicy,releasePolicyFence } from '../releases/policy';
import { currentReleaseSequenceSql } from '../releases/order';
import { Hono } from 'hono';
import { canonical, hash } from '../privacy';
import { ownerIssue } from '../stored-text';
import { authorize, body, s, guard, audit, write, conflict } from './common';

const routes = new Hono<any>();
const states = ['open', 'acknowledged', 'resolved'];
routes.post('/:project/bulk-triage', async c => {
 const auth = await authorize(c); if ('response' in auth) return auth.response;
 const project = c.req.param('project'), input = await body(c);
 if (!input || !states.includes(input.state) || !Array.isArray(input.issues) || input.issues.length < 1 || input.issues.length > 100 || typeof input.apply !== 'boolean' || Object.keys(input).some(key => !['state','issues','apply','preview','resolution'].includes(key))) throw new Error('Select 1 to 100 issues and a valid triage action');
 const resolution=input.resolution??'current';if(!['plain','current'].includes(resolution))throw new Error('Resolution must be plain or current');
 const ids = new Set<string>();
 for (const row of input.issues) {
  if (!row || Object.keys(row).sort().join() !== 'id,revision' || typeof row.id !== 'string' || row.id.length > 100 || !Number.isSafeInteger(row.revision) || row.revision < 1 || ids.has(row.id)) throw new Error('Unique issue IDs and their revisions are required');
  ids.add(row.id);
 }
 const releasePolicy=await readReleasePolicy(c.env.DB,project),rows: any[] = [];
 for (const selected of input.issues) {
  const row = await s(c.env.DB, `SELECT i.*,${currentReleaseSequenceSql('i')} current_sequence,(SELECT name FROM releases WHERE project=i.project AND seq=${currentReleaseSequenceSql('i')}) current_release FROM issues i WHERE project=? AND id=?`, project, selected.id).first<any>();
  if (!row || row.revision !== selected.revision) return c.json({error:'Selection changed; select the issues again and preview'},409);
  rows.push(row);
 }
 rows.sort((a,b) => a.id.localeCompare(b.id));
 for(const row of rows){row.plannedSequence=row.current_sequence;row.plannedRelease=row.current_release ?? 'No registered release'}
 const snapshot = rows.map(({id,revision,count,last_seen,latest_release_seq,state,plannedSequence}) => ({id,revision,count,last_seen,latest_release_seq,state,plannedSequence}));
 const preview = await hash(canonical({project,state:input.state,resolution,releasePolicyRevision:releasePolicy.revision,boundaries:rows.map(row=>row.current_release),issues:snapshot}));
 if (!input.apply) return c.json({preview,state:input.state,issues:rows.map(row => ({id:row.id,title:ownerIssue(row).title,state:row.state,revision:row.revision,count:row.count,resolvedSequence:input.state==='resolved' ? row.plannedSequence : null,resolvedRelease:input.state==='resolved'?(resolution==='plain'?'Next accepted event in any release or none':row.plannedRelease):null})),resolution:resolution==='plain'?'Plain resolution regresses on the next accepted event in any release or none.':'Each issue resolves in its current registered release. A recurrence in a later registered release reopens it.'});
 if (input.preview !== preview) return c.json({error:'Preview changed; preview the selection again'},409);
 try {
  const jobs = rows.map(row => guard(c.env.DB,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=? AND count=? AND last_seen=? AND latest_release_seq IS ?)',project,row.id,row.revision,row.count,row.last_seen,row.latest_release_seq));
  jobs.unshift(releasePolicyFence(c.env.DB,project,releasePolicy.revision));
  // All guards precede all changes, so one stale member rolls back the whole selection.
  for (const row of rows) {
   jobs.push(s(c.env.DB,"UPDATE issues SET state=?,resolved_seq=CASE WHEN ?='resolved' THEN ? ELSE NULL END,latest_release_seq=COALESCE(latest_release_seq,?),revision=revision+1 WHERE project=? AND id=?",input.state,input.state,row.plannedSequence,row.plannedSequence,project,row.id));
   jobs.push(s(c.env.DB,"INSERT INTO issue_resolutions(project,issue,mode,seen_without_release,updated,boundary_seq,observed_seq) VALUES(?,?,?,0,?,?,?) ON CONFLICT(project,issue) DO UPDATE SET mode=excluded.mode,seen_without_release=0,updated=excluded.updated,boundary_seq=excluded.boundary_seq,observed_seq=excluded.observed_seq",project,row.id,input.state==='resolved'?resolution:'current',Date.now(),row.plannedSequence,row.plannedSequence));
   jobs.push(audit(c.env.DB,project,'triage',{issue:row.id,state:input.state,revision:row.revision+1}));
  }
  await write(c,auth.session,jobs);
  return c.json({changed:rows.length,state:input.state});
 } catch(error) { return conflict(c,error); }
});
export default routes;
