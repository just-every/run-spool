import { Hono } from 'hono';
import { requestAuthority as ownerSession, nativeWrite as ownerWrite } from '../agent-door/native-authority';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditCommit } from '../audit/context';
import { recordDevMint } from '../dev-credentials';
import { ownerBatch } from '../owner-authority';
import { jsonBody } from '../owner-router';
import { hash, scrub, token } from '../privacy';
import { resolveMembership } from './resolver';

type Scope = { project: string; kind: 'agent' | 'deploy' | 'ingest' };
type Service = { id: string; organization: string; name: string; sponsor: string; state: string; version: number; created: number };
const s = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const invalid = () => { throw new AuthError('invalid_service_request', 400); };
const fields = (value: any, names: string[]) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !names.includes(key))) invalid();
};
function scopeInput(value: any): Scope {
 fields(value, ['project', 'kind']);
 if (typeof value.project !== 'string' || !value.project.length || value.project.length > 100 || /[\x00-\x1f\x7f]/.test(value.project)
  || !['agent', 'deploy', 'ingest'].includes(value.kind)) invalid();
 return { project: value.project, kind: value.kind };
}
const guard = (db: D1Database, condition: string, ...args: any[]) => s(db, `INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN ${condition} THEN 1 ELSE 0 END`, ...args);

// A service retains its original sponsor. Another administrator may manage it,
// but cannot replace a removed sponsor with their own identity while minting.
const sponsorCanMint = `EXISTS(SELECT 1 FROM oa_operators sponsor
 WHERE sponsor.id=a.sponsor AND sponsor.status='active' AND sponsor.version=?
 AND (sponsor.role='owner' OR EXISTS(SELECT 1 FROM spool_members m
  WHERE m.operator_id=sponsor.id AND m.organization=a.organization AND m.state='active'
  AND (m.role='admin' OR (m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g
   WHERE g.member=m.id AND g.project=? AND g.role IN ('maintainer','member')))))))`;
const serviceScope = `EXISTS(SELECT 1 FROM spool_service_accounts a
 JOIN spool_service_scopes scope ON scope.service=a.id
 JOIN spool_project_teams p ON p.project=scope.project AND p.organization=a.organization
 WHERE a.id=? AND a.organization=? AND a.state='active' AND a.version=?
 AND scope.project=? AND scope.kind=? AND ${sponsorCanMint})`;

export const serviceRoutes = new Hono<any>();
serviceRoutes.use('*', async (c, next) => {
 const session = await ownerSession(c.req.raw, c.env, resolveMembership);
 if (!session) return c.json({ error: 'Organization administrator required' }, 401);
 if (session.operator.role !== 'owner' && session.membership?.role !== 'admin') return c.json({ error: 'Organization administrator required' }, 403);
 if (!['GET', 'HEAD'].includes(c.req.method) && !ownerWrite(c.req.raw, c.env)) return c.json({ error: 'Same-origin required' }, 403);
 const organizations = (await s(c.env.DB, 'SELECT id FROM spool_organizations LIMIT 2').all<{ id: string }>()).results;
 if (organizations.length !== 1) return c.json({ error: 'Organization required' }, 409);
 const organization = organizations[0].id;
 if (session.operator.role !== 'owner' && !await s(c.env.DB, "SELECT 1 FROM spool_members WHERE id=? AND operator_id=? AND organization=? AND state='active' AND role='admin' AND version=?", session.membership!.id, session.operator.id, organization, session.membership!.version).first()) return c.json({ error: 'Organization administrator required' }, 403);
 c.set('serviceSession', session); c.set('serviceOrganization', organization);
 c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff');
 await next();
});

serviceRoutes.get('/', async c => {
 const organization = c.get('serviceOrganization'), db = c.env.DB;
 const [services, scopes] = await Promise.all([
  s(db, 'SELECT id,name,sponsor,state,version,created FROM spool_service_accounts WHERE organization=? ORDER BY created,id', organization).all(),
  s(db, 'SELECT scope.service,scope.project,scope.kind FROM spool_service_scopes scope JOIN spool_service_accounts a ON a.id=scope.service WHERE a.organization=? ORDER BY scope.project,scope.kind', organization).all(),
 ]);
 return c.json({ services: services.results.map((service: any) => ({ ...service, scopes: scopes.results.filter((scope: any) => scope.service === service.id).map(({ project, kind }: any) => ({ project, kind })) })) });
});

serviceRoutes.post('/', async c => {
 const input = await jsonBody(c.req.raw, 32768); fields(input, ['name', 'scopes']);
 if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 || /[\x00-\x1f\x7f]/.test(input.name)
  || !Array.isArray(input.scopes) || !input.scopes.length || input.scopes.length > 100) invalid();
 const scopes: Scope[] = input.scopes.map(scopeInput), name = scrub(input.name.trim());
 if (!name.trim() || new Set(scopes.map(scope => JSON.stringify(scope))).size !== scopes.length) invalid();
 const db = c.env.DB, organization = c.get('serviceOrganization'), session = c.get('serviceSession');
 const projects = [...new Set(scopes.map(scope => scope.project))], encoded = JSON.stringify(projects);
 const count = await s(db, 'SELECT COUNT(*) total FROM spool_project_teams WHERE organization=? AND project IN (SELECT value FROM json_each(?))', organization, encoded).first<{ total: number }>();
 if (count?.total !== projects.length) return c.json({ error: 'Project scope unavailable' }, 403);
 const id = crypto.randomUUID(), created = Date.now();
 await ownerBatch(db, session, [
  guard(db, '(SELECT COUNT(*) FROM spool_project_teams WHERE organization=? AND project IN (SELECT value FROM json_each(?)))=?', organization, encoded, projects.length),
  s(db, "INSERT INTO spool_service_accounts(id,organization,name,sponsor,state,version,created) VALUES(?,?,?,?,'active',1,?)", id, organization, name, session.operator.id, created),
  ...scopes.map(scope => s(db, 'INSERT INTO spool_service_scopes(service,project,kind) VALUES(?,?,?)', id, scope.project, scope.kind)),
  auditCommit(db),
 ]);
 return c.json({ id, name, sponsor: session.operator.id, state: 'active', version: 1, created, scopes }, 201);
});

serviceRoutes.post('/:id/keys', async c => {
 const input = await jsonBody(c.req.raw, 2048), scope = scopeInput(input);
 const db = c.env.DB, organization = c.get('serviceOrganization'), session = c.get('serviceSession');
 const service = await s(db, "SELECT * FROM spool_service_accounts WHERE id=? AND organization=? AND state='active'", c.req.param('id'), organization).first<Service>();
 if (!service) return c.json({ error: 'Service account not found' }, 404);
 const sponsor = await s(db, "SELECT version FROM oa_operators WHERE id=? AND status='active'", service.sponsor).first<{ version: number }>();
 if (!sponsor) return c.json({ error: 'Service sponsor authority unavailable' }, 403);
 const args = [service.id, organization, service.version, scope.project, scope.kind, sponsor.version, scope.project];
 if (!await s(db, `SELECT 1 WHERE ${serviceScope}`, ...args).first()) return c.json({ error: 'Service project scope unavailable' }, 403);
 const key = token(), digest = await hash(key);
 await ownerBatch(db, session, [
  guard(db, serviceScope, ...args),
  s(db, 'INSERT INTO credentials(hash,project,kind,created,revoked,minted_by,minted_version) VALUES(?,?,?,?,NULL,?,?)', digest, scope.project, scope.kind, Date.now(), service.sponsor, sponsor.version),
  s(db, 'INSERT INTO spool_service_credentials(hash,service,version) VALUES(?,?,?)', digest, service.id, service.version),
  ...session.kind === 'dev' ? [recordDevMint(db, digest)] : [],
  guard(db, serviceScope, ...args), auditCommit(db),
 ]);
 return c.json({ key, hash: digest, kind: scope.kind }, 201);
});

serviceRoutes.delete('/:id', async c => {
 const input = await jsonBody(c.req.raw, 1024); fields(input, ['version']);
 if (!Number.isSafeInteger(input.version) || input.version < 1 || input.version >= Number.MAX_SAFE_INTEGER) invalid();
 const db = c.env.DB, organization = c.get('serviceOrganization'), id = c.req.param('id');
 const service = await s(db, 'SELECT state,version FROM spool_service_accounts WHERE id=? AND organization=?', id, organization).first<{ state: string; version: number }>();
 if (!service) return c.json({ error: 'Service account not found' }, 404);
 if (service.state !== 'active' || service.version !== input.version) return c.json({ error: 'Service account changed' }, 409);
 await ownerBatch(db, c.get('serviceSession'), [
  guard(db, "EXISTS(SELECT 1 FROM spool_service_accounts WHERE id=? AND organization=? AND state='active' AND version=?)", id, organization, input.version),
  s(db, "UPDATE spool_service_accounts SET state='removed',version=version+1 WHERE id=? AND organization=? AND version=?", id, organization, input.version),
  s(db, 'UPDATE credentials SET revoked=COALESCE(revoked,?) WHERE hash IN (SELECT hash FROM spool_service_credentials WHERE service=?)', Date.now(), id),
  auditCommit(db),
 ]);
 return c.json({ ok: true });
});
