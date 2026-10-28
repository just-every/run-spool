import { agentGuard, type AgentAuthority } from '../agent-door/native-authority';
import { hash, scrub } from '../privacy';
import { exposureProof, type Deployment } from '../exposure/proof';
import { reproducerView } from '../reproducers/view';
import { connection, publicConnection } from './connection';
import { reproducerFile } from './grant';
import { GrantRefused, ProviderSession } from './provider';
import { protectFixSession } from '../follow-up/fix-boundary';

const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
// Provider answers are stored only in the shapes Spool expects.
const commit = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) ? value : null;
const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const receipts = async (db: D1Database, workflow: string) => (await s(db, 'SELECT * FROM fix_receipts WHERE workflow=? ORDER BY at,id', workflow).all<any>()).results.map(row => ({ ...row, detail: JSON.parse(row.detail) }));
const succeeded = (rows: any[], step: string) => rows.filter(row => row.step === step && row.outcome === 'succeeded');

async function inputs(db: D1Database, row: any) {
 const reproducer = await reproducerView(db, await s(db, 'SELECT * FROM reproducers WHERE id=?', row.reproducer).first());
 return { reproducer, run: reproducer.runs.find(run => run.id === row.run) };
}

// Deployed is independent of merged: a deployment manifest registered for this
// repository must name the merge commit, or a compare receipt must show the
// deployed commit contains it.
async function deployment(db: D1Database, row: any, grant: any, rows: any[]): Promise<(Deployment & { commit: string; source: string }) | null> {
 if (!row.merge_sha) return null;
 const manifests = (await s(db, 'SELECT m.release,m.environment,m.commit_sha,m.deployed_at,r.seq FROM deployment_manifests m JOIN releases r ON r.project=m.project AND r.name=m.release WHERE m.project=? AND lower(m.repository)=? ORDER BY m.deployed_at,m.release', row.project, `https://github.com/${grant.repository}`.toLowerCase()).all<any>()).results;
 const contains = (commit: string) => succeeded(rows, 'compare_commits').some(r => r.target.endsWith(`/compare/${row.merge_sha}...${commit}`) && ['ahead', 'identical'].includes(r.detail.status));
 const found = manifests.find(m => m.commit_sha === row.merge_sha || contains(m.commit_sha));
 return found ? { release: found.release, sequence: found.seq, environment: found.environment, at: found.deployed_at, commit: found.commit_sha, source: found.commit_sha === row.merge_sha ? 'deployment_manifest' : 'deployment_manifest_and_compare_receipt' } : null;
}

export async function workflowView(db: D1Database, env: any, row: any, now = Date.now()) {
 const prepared=await s(db,"SELECT actor FROM spool_agent_custody WHERE kind='fix' AND id=?",row.id).first<any>();
 const approvedBy=(await s(db,"SELECT person AS id,name,revision,created,reference FROM spool_native_approvals WHERE kind='fix' AND id=? ORDER BY revision DESC LIMIT 1",row.id).all()).results;
 const grant = JSON.parse(row.grant_spec), rows = await receipts(db, row.id), link = connection(env);
 const deployed = await deployment(db, row, grant, rows), checks = succeeded(rows, 'read_checks').at(-1);
 const branch = succeeded(rows, 'create_branch')[0], pull = succeeded(rows, 'open_draft_pull_request')[0], merge = succeeded(rows, 'read_pull_request').find(r => r.detail.merged);
 const expired = row.approved !== null && now >= row.expires;
 // Until merged, an expired grant is what blocks the next step, so it leads.
 const status = deployed ? 'deployed' : row.merged ? 'merged' : row.approved === null ? 'proposed' : expired ? 'grant_expired'
  : row.pull_number ? 'pull_request_open' : link.state === 'configured' ? 'approved' : 'approved_awaiting_connection';
 return {
  id: row.id, preparedBy:prepared?JSON.parse(prepared.actor):null,approvedBy,proofReference:approvedBy[0]?.reference??null, issue: row.issue, reproducer: row.reproducer, run: row.run, flow: row.flow, revision: row.revision, grant, status,
  connection: publicConnection(link),
  states: {
   proposed: { at: row.proposed },
   approved: row.approved === null ? null : { at: row.approved, expires: row.expires, expired },
   branch: branch ? { at: branch.at, name: grant.branch, receipt: branch.id } : null,
   pullRequest: row.pull_number ? { number: row.pull_number, url: row.pull_url, at: pull?.at ?? null, head: row.head_sha, receipt: pull?.id ?? null } : null,
   merged: row.merged ? { at: row.merged, commit: row.merge_sha, source: 'provider_receipt', receipt: merge?.id ?? null } : null,
   deployed: deployed ? { release: deployed.release, sequence: deployed.sequence, environment: deployed.environment, at: deployed.at, commit: deployed.commit, source: deployed.source } : null,
  },
  ci: checks ? { at: checks.at, head: checks.target.split('/commits/')[1]?.split('/')[0] ?? null, ...checks.detail } : null,
  receipts: rows.map(r => ({ id: r.id, step: r.step, method: r.method, target: r.target, outcome: r.outcome, status: r.status, detail: r.detail, at: r.at })),
  exposure: deployed ? await exposureProof(db, row.project, row.issue, row.flow, deployed) : null,
 };
}

// Callers hold the workflow's step lease (routes.ts), which reserved this
// step's receipts. One step forward under the approved grant: open the branch and draft pull
// request, or read its state, checks and whether a deployment contains it.
// The token is minted for this call only and revoked before returning.
export async function advance(db: D1Database, env: any, row: any, actor?:AgentAuthority) {
 const link = connection(env);
 if (link.state !== 'configured') throw new GrantRefused('Approved, awaiting connection: configure GITHUB_CONNECTION to let Spool act on this grant.');
 const grant = JSON.parse(row.grant_spec), repo = `/repos/${grant.repository}`, session = new ProviderSession(db, row, grant, link);
 await protectFixSession(db,row,session,actor?async()=>{await db.batch([agentGuard(db,actor),db.prepare('DELETE FROM spool_authority_guards')]);}:undefined);
 // A provider receipt may have committed immediately before interruption of
 // the workflow cache update. Read that evidence before opening another PR.
 if(!row.pull_number){
  const previous=succeeded(await receipts(db,row.id),'open_draft_pull_request').at(-1);
  if(previous&&Number.isSafeInteger(previous.detail.number)&&previous.detail.number>0){
   row={...row,pull_number:previous.detail.number,pull_url:previous.detail.url,head_sha:commit(previous.detail.head)};
   await s(db,'UPDATE fix_workflows SET pull_number=?,pull_url=?,head_sha=? WHERE id=? AND pull_number IS NULL',row.pull_number,row.pull_url,row.head_sha,row.id).run();
  }
 }
 if (!row.expires || Date.now() >= row.expires) await session.refuse('advance', 'The approved grant has expired; approve a renewed grant to continue.');
 const done = (step: string) => receipts(db, row.id).then(rows => succeeded(rows, step).length > 0);
 const update = (sql: string, ...args: any[]) => s(db, `UPDATE fix_workflows SET ${sql},updated=? WHERE id=?`, ...args, Date.now(), row.id).run();
 try {
  await session.open();
  if (!row.pull_number) {
   if (!await done('create_branch')) {
    const base = await session.call('read_base', 'GET', `${repo}/git/ref/heads/${grant.base.split('/').map(encodeURIComponent).join('/')}`);
    await session.call('create_branch', 'POST', `${repo}/git/refs`, { ref: `refs/heads/${grant.branch}`, sha: base.summary.sha });
   }
   if (!await done('commit_file')) {
    const { reproducer, run } = await inputs(db, row), content = reproducerFile(reproducer, run);
    if (await hash(content) !== grant.file.sha256) await session.refuse('commit_file', 'The reproducer record differs from the approved file.');
    await session.call('commit_file', 'PUT', `${repo}/contents/${grant.file.path.split('/').map(encodeURIComponent).join('/')}`, { message: `Add Spool reproducer ${row.reproducer}`, content: base64(content), branch: grant.branch });
   }
   const nativeApprover=await s(db,"SELECT name FROM spool_native_approvals WHERE kind='fix' AND id=? ORDER BY revision DESC LIMIT 1",row.id).first<{name:string}>();
   const body=grant.pullRequest.body+(nativeApprover?`\n\nNative repository grant authorized by ${nativeApprover.name}.`:'')+(actor?.context.approvers.length?`\nCompany approval: ${actor.context.approvers.map(p=>p.name).join(', ')}.`:'');
   const pull = await session.call('open_draft_pull_request', 'POST', `${repo}/pulls`, { title: grant.pullRequest.title, body, head: grant.branch, base: grant.base, draft: true });
   if (!Number.isSafeInteger(pull.summary.number) || pull.summary.number < 1 || !/^https:\/\/[^\s?#]+$/.test(pull.summary.url)) throw new Error('GitHub returned an unexpected pull request');
   await update('pull_number=?,pull_url=?,head_sha=?', pull.summary.number, scrub(pull.summary.url), commit(pull.summary.head));
   return;
  }
  const pull = await session.call('read_pull_request', 'GET', `${repo}/pulls/${row.pull_number}`), merged = pull.summary.merged ? commit(pull.summary.mergeCommit) : null, head = commit(pull.summary.head);
  if (merged) await update('head_sha=?,merged=COALESCE(merged,?),merge_sha=COALESCE(merge_sha,?)', head ?? row.head_sha, Date.parse(pull.summary.mergedAt) || Date.now(), merged);
  else await update('head_sha=?', head ?? row.head_sha);
  if (head) await session.call('read_checks', 'GET', `${repo}/commits/${head}/check-runs`);
  const merge = merged ?? row.merge_sha;
  if (merge) {
   const compared = new Set(succeeded(await receipts(db, row.id), 'compare_commits').map(r => r.target));
   const later = (await s(db, 'SELECT DISTINCT commit_sha FROM deployment_manifests WHERE project=? AND lower(repository)=? AND commit_sha<>? ORDER BY deployed_at DESC LIMIT 3', row.project, `https://github.com/${grant.repository}`.toLowerCase(), merge).all<any>()).results;
   for (const { commit_sha } of later) if (!compared.has(`${repo}/compare/${merge}...${commit_sha}`)) await session.call('compare_commits', 'GET', `${repo}/compare/${merge}...${commit_sha}`);
  }
 } finally { await session.close(); }
}
