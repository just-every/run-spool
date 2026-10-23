import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { scrub } from '../privacy';
import { suspectView } from './read';
export const suspectRoutes = ownerProjectRouter();
const windowFor = (c: any) => {
 const to = c.req.query('to') === undefined ? Date.now() : Number(c.req.query('to')), from = c.req.query('from') === undefined ? to - 86400000 : Number(c.req.query('from'));
 if (![from,to].every(Number.isSafeInteger) || from < 0 || to <= from || to - from > 90*86400000) throw new Error('Use a receipt window of at most 90 days');
 return {from,to};
};
suspectRoutes.use('/issues/:issue', async (c, next) => {
 if (!await c.env.DB.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(c.req.param('project')!,c.req.param('issue')!).first()) return c.json({error:'Issue not found'},404);
 await next();
});
suspectRoutes.get('/issues/:issue', async c => { const {from,to}=windowFor(c);return c.json(await suspectView(c.env.DB,c.req.param('project')!,c.req.param('issue')!,from,to)); });
suspectRoutes.put('/issues/:issue', async c => {
 const input=await jsonBody(c.req.raw,4096),project=c.req.param('project')!,issue=c.req.param('issue')!;
 if (!input || Object.keys(input).sort().join()!=='judgment,note,release,revision,sha' || !['confirmed','rejected'].includes(input.judgment) || typeof input.note!=='string' || !input.note.trim() || input.note.length>600 || !Number.isSafeInteger(input.revision) || input.revision<0) return c.json({error:'Supply a candidate, judgment, evidence note (1–600 characters) and current revision'},400);
 const view=await suspectView(c.env.DB,project,issue,Date.now()-86400000,Date.now());
 if (!view.candidates.some(row=>row.release===input.release && row.sha===input.sha)) return c.json({error:'Suspect candidate unavailable; refresh'},409);
 const time=Date.now(),revision=input.revision+1,sha=input.sha??'';
 const result=await ownerWrites(c,[
  c.env.DB.prepare(`INSERT INTO suspect_decisions(project,issue,release,sha,judgment,note,revision,updated,operator_id) SELECT ?,?,?,?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM suspect_decisions WHERE project=? AND issue=? AND release=? AND sha=? AND revision=?) ON CONFLICT(project,issue,release,sha) DO UPDATE SET judgment=excluded.judgment,note=excluded.note,revision=excluded.revision,updated=excluded.updated,operator_id=excluded.operator_id WHERE suspect_decisions.revision=? RETURNING revision`).bind(project,issue,input.release,sha,input.judgment,scrub(input.note),revision,time,c.get('ownerSession').operator.id,input.revision,project,issue,input.release,sha,input.revision,input.revision),
  c.env.DB.prepare("INSERT INTO audit SELECT ?,?,'suspect_judged',?,? WHERE changes()=1").bind(crypto.randomUUID(),project,JSON.stringify({issue,release:input.release,sha,judgment:input.judgment,revision}),time),
 ]);
 return result[0].results.length ? c.json({judgment:input.judgment,revision}) : c.json({error:'Suspect judgment changed; refresh'},409);
});
