import type { Context } from 'hono';
import { hash } from '../privacy';
import { authorizeDeploy } from '../sentry/deploy';
import { cliError } from './errors';

export type CliAuthority = { project: string; auth: { actor: string; guard: () => D1PreparedStatement } };

/** Every /api/0 handler calls this itself. The auth token is a Spool project deploy key sent as a Bearer
 * token, exactly where sentry-cli puts SENTRY_AUTH_TOKEN. The key, not the URL, names the project: an
 * organization or project slug the key does not own is refused after the key itself is proven, so no
 * slug can probe for other projects. Ingest, agent (read-only), revoked and unknown keys store nothing. */
export async function cliAuthority(c: Context, slugs: unknown[] = []): Promise<CliAuthority | { response: Response }> {
 const bearer = /^Bearer ([a-zA-Z0-9_]{1,128})$/.exec(c.req.header('authorization') ?? '')?.[1];
 if (!bearer) return { response: cliError(c, 401, 'A project deploy key is required as the auth token.') };
 const known = await (c.env.DB as D1Database).prepare('SELECT project FROM credentials WHERE hash=?').bind(await hash(bearer)).first<{ project: string }>();
 if (!known) return { response: cliError(c, 401, 'Invalid deploy key') };
 const auth = await authorizeDeploy(c, known.project);
 if ('response' in auth) {
  const body = await auth.response.clone().json().catch(() => ({})) as { error?: string };
  return { response: cliError(c, auth.response.status, body.error ?? 'Not authorized') };
 }
 if (slugs.some(slug => slug !== known.project)) return { response: cliError(c, 403, 'Deploy project scope required: this key belongs to another project.') };
 return { project: known.project, auth };
}
