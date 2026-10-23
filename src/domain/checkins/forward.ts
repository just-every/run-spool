import { demoEffect } from '../../modules/demo/index.mjs';
import type { TrustedTransport } from '../../modules/integrations/core/types';
import { validateConnectionUrl, receiptFor } from './connection';
import type { CheckIn } from './item';
import type { CheckInOutcome } from './outcomes';

// One attempt, one bounded wait, no retry queue: a receiver outage is a counted outcome, not state.
const defaultTimeoutMs = 4000;
const timeoutMs = (env: { CHECKIN_FORWARD_TIMEOUT_MS?: string }) => { const value = Number(env.CHECKIN_FORWARD_TIMEOUT_MS); return Number.isInteger(value) && value >= 20 && value <= 10000 ? value : defaultTimeoutMs; };
type Env = { DB: D1Database; INTEGRATION_EGRESS?: TrustedTransport; CHECKIN_FORWARD_TIMEOUT_MS?: string };
/** Routes one check-in to its project's connection. Only the mapped receipt leaves Spool: the path names
 * start, success or failure; the body is empty. Duration, monitor config, release and environment stay here. */
export async function routeCheckIn(env: Env, project: string, checkIn: CheckIn): Promise<CheckInOutcome> {
 const row = await env.DB.prepare('SELECT url,enabled FROM checkin_routes WHERE project=? AND slug=?').bind(project, checkIn.slug).first<{ url: string; enabled: number }>();
 if (!row) return 'check_in_unrouted';
 if (!row.enabled) return 'check_in_disabled';
 const egress = env.INTEGRATION_EGRESS;
 if (!egress) return 'check_in_egress_unconfigured';
 let base: string;
 try { base = validateConnectionUrl(row.url); } catch { return 'check_in_forward_failed'; }
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const response = await Promise.race([
   demoEffect(() => egress.send({ url: `${base}/${receiptFor(checkIn.status)}`, headers: { 'content-type': 'application/json' }, body: '{}' }), () => ({ status: 204, headers: {}, body: '' })),
   new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs(env)); }),
  ]);
  return response.status >= 200 && response.status < 300 ? 'check_in_routed' : 'check_in_forward_failed';
 } catch { return 'check_in_forward_failed'; } finally { clearTimeout(timer); }
}
