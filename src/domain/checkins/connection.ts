import { validateDestination } from '../../modules/integrations/core/destination';

// Uptime's URL capability door: POST /api/heartbeats/<monitor>/url/<token>/{start,success,fail}.
// The token is the whole authority, so it is validated here and then only ever sent through egress.
const capabilityPath = /^\/api\/heartbeats\/[A-Za-z0-9_-]{1,128}\/url\/[A-Za-z0-9_-]{8,256}$/;
export function validateConnectionUrl(value: unknown): string {
 if (typeof value !== 'string') throw new Error('Expected an Uptime heartbeat capability URL');
 const url = validateDestination(value.trim());
 if (url.search || !capabilityPath.test(url.pathname)) throw new Error('Expected an Uptime heartbeat capability URL: https://<uptime>/api/heartbeats/<monitor>/url/<token>');
 return url.href;
}
export const receiptFor = (status: 'in_progress' | 'ok' | 'error') => ({ in_progress: 'start', ok: 'success', error: 'fail' })[status];
/** Public view of a stored connection: the host only, never the monitor id or token. */
export const maskedConnection = (row: { slug: string; url: string; enabled: number; revision: number; updated: number }) =>
 ({ slug: row.slug, host: new URL(row.url).hostname, enabled: row.enabled === 1, revision: row.revision, updated: row.updated, url: `https://${new URL(row.url).hostname}/…/••••••••` });
