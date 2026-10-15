import { demoEffect } from '../../modules/demo/index.mjs';
import { demoWrite } from './demo-provider';
import { scrub } from '../privacy';
import { appJwt, type Connection } from './connection';
import { FIX_PERMISSIONS, type FixOperation } from './grant';

// Every provider call goes through here: it is refused unless the approved,
// unexpired grant lists the operation, and each call (or refusal) leaves a
// receipt with only the facts it established, never a token.
type Configured = Extract<Connection, { state: 'configured' }>;
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
export class GrantRefused extends Error {}
// fix_receipt_capacity in migration 0032, and the most receipts one step can write
// (mint, read base, branch, file, pull request or read, checks, three compares, revoke).
export const RECEIPT_LIMIT = 200, STEP_RECEIPTS = 8;
// GitHub owner and repository names are case-insensitive.
export const sameRepository = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const SUMMARY: Record<string, (body: any) => object> = {
 mint_token: body => ({ expiresAt: String(body.expires_at ?? ''), permissions: body.permissions ?? {}, repositories: (body.repositories ?? []).map((r: any) => String(r.full_name ?? r.name)) }),
 read_base: body => ({ sha: String(body.object?.sha ?? '') }),
 create_branch: body => ({ ref: String(body.ref ?? ''), sha: String(body.object?.sha ?? '') }),
 commit_file: body => ({ path: String(body.content?.path ?? ''), commit: String(body.commit?.sha ?? '') }),
 open_draft_pull_request: body => ({ number: Number(body.number), url: String(body.html_url ?? ''), draft: body.draft === true, head: String(body.head?.sha ?? '') }),
 read_pull_request: body => ({ state: String(body.state ?? ''), merged: body.merged === true, mergedAt: body.merged_at ?? null, mergeCommit: body.merged ? String(body.merge_commit_sha ?? '') : null, head: String(body.head?.sha ?? '') }),
 read_checks: body => ({ total: Number(body.total_count ?? 0), runs: (body.check_runs ?? []).slice(0, 20).map((r: any) => ({ name: scrub(String(r.name ?? '')).slice(0, 100), status: String(r.status ?? ''), conclusion: r.conclusion === null || r.conclusion === undefined ? null : String(r.conclusion) })) }),
 compare_commits: body => ({ status: String(body.status ?? ''), aheadBy: Number(body.ahead_by ?? 0), behindBy: Number(body.behind_by ?? 0) }),
 revoke_token: () => ({}),
};

export class ProviderSession {
 private token: string | null = null;
 private last: number | null = null;
 constructor(private db: D1Database, private workflow: any, private grant: any, private connection: Configured) {}
 private async receipt(step: string, method: string, target: string, outcome: 'succeeded' | 'failed' | 'refused', status: number | null, detail: object) {
  // Receipt times strictly increase per workflow, so their order is their sequence.
  this.last ??= (await s(this.db, 'SELECT MAX(at) at FROM fix_receipts WHERE workflow=?', this.workflow.id).first<any>())?.at ?? 0;
  this.last = Math.max(Date.now(), this.last! + 1);
  await s(this.db, 'INSERT INTO fix_receipts VALUES(?,?,?,?,?,?,?,?,?,?)', crypto.randomUUID(), this.workflow.id, this.workflow.project, step, method, target, outcome, status, JSON.stringify(detail), this.last).run();
 }
 async refuse(step: string, reason: string) { await this.receipt(step, '-', '-', 'refused', null, { reason, sent: false }); throw new GrantRefused(reason); }
 private async allow(step: FixOperation) {
  if (!this.grant.operations.includes(step)) await this.refuse(step, 'The approved grant does not list this operation.');
  // Revoking only reduces access, so it stays allowed after expiry.
  if (step !== 'revoke_token' && (!this.workflow.expires || Date.now() >= this.workflow.expires)) await this.refuse(step, 'The approved grant has expired; approve a renewed grant to continue.');
 }
 async call(step: FixOperation, method: string, path: string, body?: object): Promise<any> {
  await this.allow(step);
  const repo = `/repos/${this.grant.repository}/`;
  if (step !== 'mint_token' && step !== 'revoke_token' && !path.toLowerCase().startsWith(repo.toLowerCase())) await this.refuse(step, 'The call names a repository outside the grant.');
  let response: Response, parsed: any = null;
  try {
   const send = async () => {
    const authorization: Record<string, string> = this.connection.demo ? {} : { Authorization: step === 'mint_token' ? `Bearer ${await appJwt(this.connection)}` : `Bearer ${this.token}` };
    return fetch(this.connection.apiOrigin + path, { method, redirect: 'manual', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'spool-fix-workflow', ...authorization, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} });
   };
   response = ['GET', 'HEAD', 'OPTIONS'].includes(method) && !['read_pull_request', 'read_checks'].includes(step) ? await send() : await demoEffect(send, () => demoWrite(step, this.grant.repository, { ...body, ...(step === 'commit_file' ? { path: decodeURIComponent(path.split('/contents/')[1]) } : {}) }, this.workflow));
   parsed = response.status === 204 ? {} : await response.json().catch(() => null);
  } catch (error) {
   await this.receipt(step, method, path, 'failed', null, { reason: 'network_error' });
   throw new Error(`GitHub ${step} failed: network error`);
  }
  if (!response.ok) {
   await this.receipt(step, method, path, 'failed', response.status, { message: scrub(String(parsed?.message ?? '')).slice(0, 300) });
   throw new Error(`GitHub ${step} failed: HTTP ${response.status}`);
  }
  // Hold a minted token before writing its receipt, so close() can always revoke it.
  if (step === 'mint_token') this.token = typeof parsed?.token === 'string' && parsed.token ? parsed.token : null;
  const summary = SUMMARY[step](parsed ?? {});
  await this.receipt(step, method, path, 'succeeded', response.status, summary);
  return { body: parsed, summary };
 }
 // One installation token for this repository with exactly the granted
 // permissions. An answer not exactly this repository, or broader, is refused and the token revoked at once.
 async open() {
  const [, name] = this.grant.repository.split('/');
  const minted = await this.call('mint_token', 'POST', `/app/installations/${this.connection.installationId}/access_tokens`, { repositories: [name], permissions: FIX_PERMISSIONS });
  const granted = { ...minted.body.permissions }; delete granted.metadata;
  // Provably one repository: a missing, empty or wider list is not that proof.
  const repositories = Array.isArray(minted.body.repositories) ? minted.body.repositories.map((r: any) => String(r?.full_name ?? '')) : [];
  if (JSON.stringify(Object.entries(granted).sort()) !== JSON.stringify(Object.entries(FIX_PERMISSIONS).sort()) || repositories.length !== 1 || !sameRepository(repositories[0], this.grant.repository)) {
   await this.close();
   await this.refuse('mint_token', 'GitHub returned a token not provably limited to this one repository with exactly the granted permissions; it was revoked unused.');
  }
 }
 async close() {
  if (!this.token) return;
  try { await this.call('revoke_token', 'DELETE', '/installation/token'); } finally { this.token = null; }
 }
}
