import { Hono } from 'hono';
import type { Bindings } from '../auth/bindings';
import { apiAccess, apiError } from './api-middleware';

export const healthApi = new Hono<{Bindings: Bindings; Variables: {project: string | null}}>()
 .use('*', apiAccess)
 .onError(apiError)
 .get('/health', async c => {
  // Both tables are part of readiness, even before the first project or tick.
  const [, scheduler] = await c.env.DB.batch<{last_run: number | null}>([
   c.env.DB.prepare('SELECT 1 FROM projects LIMIT 1'),
   c.env.DB.prepare('SELECT last_run FROM alert_scheduler WHERE id=1'),
  ]);
  const lastRun = scheduler.results[0]?.last_run;
  return c.json({
   status: 'ok', ok: true,
   deployment: { sourceSha: c.env.RER_DEPLOY_SOURCE, fingerprint: c.env.RER_DEPLOY_FINGERPRINT, versionId: c.env.RER_VERSION?.id },
   alerts: { lastScheduledRun: lastRun ? new Date(lastRun).toISOString() : null },
  });
 });
