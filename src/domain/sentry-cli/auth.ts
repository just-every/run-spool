import type { Context } from 'hono';
import { hash } from '../privacy';
import { mintedByCurrentPerson } from '../credential-fence';
import { mintAdmission } from '../dev-credentials';
import { cliError } from './errors';

export type CliAuthority = { project: string; auth: { actor: string; actorKey: string; guard: () => D1PreparedStatement } };

/** CLI authority is always the supplied project deploy bearer, independently of any owner cookie.
 * Native owner-or-deploy doors retain their own authority policy. No slug is inspected before the key. */
export async function cliAuthority(c: Context, slugs: unknown[] = []): Promise<CliAuthority | { response: Response }> {
 const bearer = /^Bearer ([a-zA-Z0-9_]{1,128})$/.exec(c.req.header('authorization') ?? '')?.[1];
 if (!bearer) return { response: cliError(c, 401, 'A project deploy key is required as the auth token.') };
 const db = c.env.DB as D1Database, digest = await hash(bearer);
 const current = `revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(c.req.raw)}
  AND EXISTS(SELECT 1 FROM projects WHERE id=credentials.project)
  AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete')`;
 const grant = await db.prepare(`SELECT project,kind FROM credentials WHERE hash=? AND kind IN ('agent','deploy') AND ${current}`)
  .bind(digest).first<{ project: string; kind: string }>();
 if (!grant) return { response: cliError(c, 401, 'Invalid deploy key') };
 if (grant.kind !== 'deploy') return { response: cliError(c, 403, 'Agent keys are read-only and limited to their project.') };
 if (slugs.some(slug => slug !== grant.project)) return { response: cliError(c, 403, 'Deploy project scope required: this key belongs to another project.') };
 const project = grant.project, actorKey = await hash('deploy:' + digest);
 const actor = await db.prepare('SELECT label FROM deployment_actors WHERE project=? AND authority=?').bind(project, actorKey).first<{ label: string }>();
 return { project, auth: {
  // The label is persisted only inside createDeploy's guarded mutation, never during a denied request.
  actor: actor?.label ?? 'actor-' + crypto.randomUUID(), actorKey,
  guard: () => db.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='deploy' AND ${current}) THEN 1 ELSE 0 END`).bind(digest, project),
 } };
}
