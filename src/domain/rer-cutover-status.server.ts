import { DoorError, verifyRerGrant } from '../modules/import-kit/src/door/index.ts';
import { ownerClaimConfig } from '../editor/owner-claim-config.server';
import type { ManagedBindings } from '../editor/bindings';
import { jsonBody } from './owner-router';
import { doorKey } from './sentry-import/door.server';

export const cutoverStatusPath = '/api/rer/cutover-status';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const answer = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** `{since}`: one ISO 8601 date-time, nothing else. */
function sinceOf(input: Record<string, unknown>): number | null {
 if (Object.keys(input).length !== 1 || typeof input.since !== 'string' || !isoTime.test(input.since)) return null;
 const since = Date.parse(input.since);
 return Number.isSafeInteger(since) ? since : null;
}

/**
 * POST /api/rer/cutover-status: Run Edit Run's signed read for a Sentry move's
 * embed check and difference report. `events_since` counts events Spool's
 * ingest received since `since` (imported Sentry history is never counted),
 * `last_event_at` is the newest received event, and `created_since` counts the
 * issues and events created in Spool since then rather than imported. Counts
 * and a time only: never a project, issue, event, title, payload, name, email,
 * key or secret. The grant is an RER-signed `cutover-status` grant for this
 * installation under its owner-claim key ring; a key the owner revoked in
 * Business imports is refused. Read-only.
 */
export async function rerCutoverStatus(request: Request, env: ManagedBindings): Promise<Response> {
 if (request.method !== 'POST') return answer({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
 // Without Run Edit Run's owner-claim trust (self-host) there is no signer: the route does not exist.
 let claim: ReturnType<typeof ownerClaimConfig>;
 try { claim = ownerClaimConfig(env); } catch { return answer({ error: 'not_found' }, 404); }
 try {
  const { kid } = await verifyRerGrant(request, claim, 'cutover-status');
  if (await env.DB.prepare('SELECT 1 FROM ik_door_revoked_keys WHERE installation_id=? AND kid=?').bind(await doorKey(env), kid).first())
   return answer({ error: 'invalid_grant' }, 403);
 } catch (error) {
  if (error instanceof DoorError) return answer({ error: error.code }, error.status);
  throw error;
 }
 let since: number | null = null;
 try { since = sinceOf(await jsonBody(request, 1024)); } catch { /* refused below */ }
 if (since === null) return answer({ error: 'invalid_since' }, 400);
 const [received, latest, issues] = await env.DB.batch([
  env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE historical=0 AND received>=?').bind(since),
  env.DB.prepare('SELECT MAX(received) AS at FROM events WHERE historical=0'),
  env.DB.prepare("SELECT COUNT(*) AS n FROM issues i WHERE i.first_seen>=? AND NOT EXISTS(SELECT 1 FROM sentry_import_targets m WHERE m.kind='issue' AND m.id=i.id)").bind(since),
 ]);
 const count = (result: D1Result) => Number((result.results[0] as { n: number }).n);
 const at = (latest.results[0] as { at: number | null }).at;
 // Ingest is the only writer of non-historical events, so every event created since was received since.
 const events = count(received);
 return answer({ events_since: events, last_event_at: at === null ? null : new Date(at).toISOString(), created_since: { issues: count(issues), events } });
}
