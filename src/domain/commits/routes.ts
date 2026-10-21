import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { resolveIssue, primaryShortIdSql } from '../short-ids/lookup';
import { commitSharing, commitLinkSql } from './sharing';

// Owner surfaces: the issue timeline with commit author and message, the repository
// link log and the sharing choice. None of these is an agent or deploy-key read.
export const commitRoutes = ownerProjectRouter();
commitRoutes.onError((e, c) => { if (e instanceof AuthError) return c.json({ error: e.code }, e.status as any); throw e; });
commitRoutes.get('/issues/:issue', async c => {
 const project = c.req.param('project')!, found = await resolveIssue(c.env.DB, project, c.req.param('issue'));
 if (!found) return c.json({ error: 'Issue not found' }, 404);
 const issue = await c.env.DB.prepare(`SELECT i.id,i.state,${primaryShortIdSql('i')} short_id,(SELECT mode FROM issue_resolutions WHERE project=i.project AND issue=i.id) resolution_mode,(SELECT updated FROM issue_resolutions WHERE project=i.project AND issue=i.id) resolution_updated FROM issues i WHERE i.project=? AND i.id=?`).bind(project, found.issue).first<any>();
 if (!issue) return c.json({ error: 'Issue not found' }, 404);
 const links = (await c.env.DB.prepare(`SELECT link.*,(SELECT json_object('release',json_extract(a.payload,'$.release.name'),'at',a.created) FROM alerts a WHERE a.project=? AND a.issue=? AND a.kind='regression' AND a.created>=link.resolved ORDER BY a.created,a.id LIMIT 1) regressed FROM (${commitLinkSql('?', '?')}) link`).bind(project, found.issue, project, found.issue).all<any>()).results;
 return c.json({ issue: issue.id, shortId: issue.short_id, state: issue.state, links: links.map(row => ({
  sha: row.sha, citation: row.citation, shortId: row.short_id, linked: row.linked, release: row.release, resolved: row.resolved, pr: row.pr,
  current: issue.state === 'resolved' && issue.resolution_mode === 'named' && row.resolved !== null && row.resolved === issue.resolution_updated,
  author: row.author_name === null && row.author_email === null ? null : { name: row.author_name, email: row.author_email }, message: row.message, expired: row.expired,
  regressed: row.regressed ? JSON.parse(row.regressed) : null })) });
});
commitRoutes.get('/link-log', async c => c.json({ rows: (await c.env.DB.prepare('SELECT sha,citation,reason,created FROM repository_link_log WHERE project=? ORDER BY created DESC,sha,citation LIMIT 200').bind(c.req.param('project')!).all()).results,
 reasons: { unknown: 'No issue in this installation has this short ID or alias.', other_project: 'The short ID belongs to another project; this project’s deploy key cannot change it.', inaccessible: 'The short ID names imported history, which a deploy key cannot change.' } }));
commitRoutes.get('/sharing', async c => c.json(await commitSharing(c.env.DB, c.req.param('project')!)));
commitRoutes.put('/sharing', async c => {
 let input: any;
 try { input = await jsonBody(c.req.raw, 1000); if (Object.keys(input).sort().join() !== 'revision,share' || typeof input.share !== 'boolean' || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('Expected share (true or false) and the current revision'); } catch (e) { return c.json({ error: (e as Error).message }, 400); }
 const project = c.req.param('project')!, revision = input.revision + 1, time = Date.now();
 const result = await ownerWrites(c, [
  c.env.DB.prepare('INSERT INTO commit_sharing(project,share,revision,updated) SELECT ?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM commit_sharing WHERE project=? AND revision=?) ON CONFLICT(project) DO UPDATE SET share=excluded.share,revision=excluded.revision,updated=excluded.updated WHERE commit_sharing.revision=? RETURNING revision').bind(project, input.share ? 1 : 0, revision, time, input.revision, project, input.revision, input.revision),
  c.env.DB.prepare("INSERT INTO audit SELECT ?,?,'commit_sharing_changed',?,? WHERE changes()=1").bind(crypto.randomUUID(), project, JSON.stringify({ revision, share: input.share ? 1 : 0 }), time),
 ]);
 return result[0].results.length ? c.json({ share: input.share, revision, updated: time }) : c.json({ error: 'Commit sharing changed; refresh and choose again' }, 409);
});
