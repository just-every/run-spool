import { jsonBody, ownerProjectRouter, ownerWrites } from '../owner-router';
import { auditCommit } from '../audit/context';
import { runtimeBindings } from '../../auth/bindings';
import { appJwt, connection, publicConnection } from './connection';
import { savedConnection } from './saved-connection';
import { FIX_PERMISSIONS } from './grant';
import { sameRepository } from './provider';

export const connectionRoutes = ownerProjectRouter();
connectionRoutes.use('*', async (c, next) => {
  const person = c.get('ownerSession');
  if (person.kind === 'agent' || person.kind === 'reviewer' || person.operator.role !== 'owner') return c.json({ error: 'Installation owner required' }, 403);
  await next();
});
connectionRoutes.put('/', async c => {
  const input = await jsonBody(c.req.raw, 16384), env = runtimeBindings(c.env);
  const checked = connection({ ...env, GITHUB_CONNECTION: JSON.stringify(input) });
  if (checked.state !== 'configured' || checked.demo) return c.json({ error: checked.state === 'invalid' ? checked.reason : 'Supply the GitHub App connection fields' }, 400);
  try { await appJwt(checked); } catch { return c.json({ error: 'privateKey must be a valid RSA PEM private key' }, 400); }
  await ownerWrites(c, [c.env.DB.prepare('INSERT INTO spool_github_connection VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(JSON.stringify(input), Date.now()), auditCommit(c.env.DB)]);
  return c.json(publicConnection(checked));
});
connectionRoutes.post('/test', async c => {
  const input = await jsonBody(c.req.raw, 2048), link = await savedConnection(runtimeBindings(c.env));
  if (link.state !== 'configured' || link.demo) return c.json({ error: 'Connect a GitHub App before testing' }, 409);
  if (typeof input.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository) || typeof input.branch !== 'string' || !/^[A-Za-z0-9_./-]{1,200}$/.test(input.branch)) return c.json({ error: 'Supply repository (owner/name) and base branch' }, 400);
  let token: string | null = null, problem: string | null = null;
  const call = async (path: string, method: string, authorization: string, body?: unknown) => {
    const response = await fetch(link.apiOrigin + path, { method, redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${authorization}`, 'User-Agent': 'spool-connection-test', ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
    const value = response.status === 204 ? {} : await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(`GitHub connection test failed: HTTP ${response.status}`);
    return value;
  };
  try {
    const minted = await call(`/app/installations/${link.installationId}/access_tokens`, 'POST', await appJwt(link), {repositories:[input.repository.split('/')[1]],permissions:FIX_PERMISSIONS});
    token = typeof minted.token === 'string' && minted.token ? minted.token : null;
    const permissions = {...minted.permissions}; delete permissions.metadata;
    if (!token || minted.repositories?.length !== 1 || !sameRepository(String(minted.repositories[0].full_name), input.repository) || JSON.stringify(Object.entries(permissions).sort()) !== JSON.stringify(Object.entries(FIX_PERMISSIONS).sort())) throw new Error('GitHub did not confirm access limited to this repository with the required permissions');
    await call(`/repos/${input.repository}/git/ref/heads/${encodeURIComponent(input.branch)}`, 'GET', token);
  } catch (error) { problem = error instanceof Error && error.message.startsWith('GitHub') ? error.message : 'GitHub connection test could not complete'; }
  finally { if (token) { try { await call('/installation/token', 'DELETE', token); } catch { problem = 'GitHub could not confirm that the test token was revoked; it expires within one hour'; } } }
  if (problem) return c.json({ error: problem }, 502);
  await ownerWrites(c, [auditCommit(c.env.DB)]);
  return c.json({ tested: true, repository: input.repository, branch: input.branch, message: 'Connection passed. Repository access and permissions checked; test token revoked. No branch or pull request was created.' });
});
