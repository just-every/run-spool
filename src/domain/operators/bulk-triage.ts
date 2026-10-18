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
 const rows: any[] = [];
 for (const selected of input.issues) {
  const row = await s(c.env.DB, `SELECT i.*,(SELECT name FROM releases WHERE project=i.project AND seq=CASE WHEN COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=i.project),'sentry')='registered' THEN i.latest_release_seq ELSE COALESCE((SELECT observed_seq FROM issue_resolutions WHERE project=i.project AND issue=i.id),i.latest_release_seq) END) current_release FROM issues i WHERE project=? AND id=?`, project, selected.id).first<any>();
  if (!row || row.revision !== selected.revision) return c.json({error:'Selection changed; select the issues again and preview'},409);
  rows.push(row);
 }
 rows.sort((a,b) => a.id.localeCompare(b.id));
 const releases = await s(c.env.DB,'SELECT name,seq FROM releases WHERE project=? ORDER BY seq DESC LIMIT 1',project).first<any>();
 for(const row of rows){row.plannedSequence=row.latest_release_seq ?? releases?.seq ?? 0;row.plannedRelease=row.current_release ?? (row.latest_release_seq==null?releases?.name:null) ?? 'No registered release'}
 const snapshot = rows.map(({id,revision,count,last_seen,latest_release_seq,state,plannedSequence}) => ({id,revision,count,last_seen,latest_release_seq,state,plannedSequence}));
 const preview = await hash(canonical({project,state:input.state,resolution,issues:snapshot}));
 if (!input.apply) return c.json({preview,state:input.state,issues:rows.map(row => ({id:row.id,title:ownerIssue(row).title,state:row.state,revision:row.revision,count:row.count,resolvedSequence:input.state==='resolved' ? row.plannedSequence : null,resolvedRelease:input.state==='resolved'?(resolution==='plain'?'Next accepted event in any release or none':row.plannedRelease):null})),resolution:resolution==='plain'?'Plain resolution regresses on the next accepted event in any release or none.':'Each issue resolves in its current registered release. A recurrence in a later registered release reopens it.'});
 if (input.preview !== preview) return c.json({error:'Preview changed; preview the selection again'},409);
 try {
  const jobs = rows.map(row => guard(c.env.DB,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=? AND count=? AND last_seen=? AND latest_release_seq IS ?)',project,row.id,row.revision,row.count,row.last_seen,row.latest_release_seq));
  // All guards precede all changes, so one stale member rolls back the whole selection.
  for (const row of rows) {
   jobs.push(s(c.env.DB,"UPDATE issues SET state=?,resolved_seq=CASE WHEN ?='resolved' THEN ? ELSE NULL END,latest_release_seq=COALESCE(latest_release_seq,?),revision=revision+1 WHERE project=? AND id=?",input.state,input.state,row.plannedSequence,row.plannedSequence,project,row.id));
   jobs.push(s(c.env.DB,"INSERT INTO issue_resolutions(project,issue,mode,seen_without_release,updated,boundary_seq,observed_seq) VALUES(?,?,?,0,?,NULL,?) ON CONFLICT(project,issue) DO UPDATE SET mode=excluded.mode,seen_without_release=0,updated=excluded.updated,boundary_seq=CASE WHEN (SELECT algorithm FROM issues WHERE id=excluded.issue)<>'sentry-chain-v1' OR COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=excluded.project),'sentry')='registered' THEN excluded.observed_seq ELSE issue_resolutions.observed_seq END",project,row.id,input.state==='resolved'?resolution:'current',Date.now(),row.plannedSequence));
   jobs.push(audit(c.env.DB,project,'triage',{issue:row.id,state:input.state,revision:row.revision+1}));
  }
  await write(c,auth.session,jobs);
  return c.json({changed:rows.length,state:input.state});
 } catch(error) { return conflict(c,error); }
});
export default routes;
