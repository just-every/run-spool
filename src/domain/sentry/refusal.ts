import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '../../auth/bindings';

const messages: Record<string, string> = {
  invalid_ingest_key: 'Check that the SDK uses a current ingest DSN from Settings → Projects & keys on this Spool installation.',
  origin_not_allowed: 'Add the app’s exact Origin under Your website address in Settings → Projects & keys, or check Allowed browser domains in Privacy & filtering.',
  referer_not_allowed: 'Check the Referer against Your website address in Settings → Projects & keys and Allowed browser domains in Privacy & filtering.',
  ingest_authority_changed: 'Retry the same envelope. If it still fails, check the ingest key and allowed origins or domains in the project’s Settings.',
  inbound_policy_changed: 'Retry the same envelope with the project’s current inbound settings.',
  transaction_not_confirmed: 'Spool could not confirm storage. Retry the same envelope so its event ID can prevent a duplicate.',
  preflight_not_allowed: 'Send an OPTIONS preflight with Origin, POST and only Content-Type, X-Sentry-Auth or Authorization as request headers.',
  project_or_origin_not_allowed: 'Verify the project DSN and add the app’s exact Origin under Your website address in Settings → Projects & keys.',
};

export function sentryRefusal(c: Context<{ Bindings: Bindings }>, result: { reason?: string; outcome?: string }, status: number) {
  const reason = result.reason ?? result.outcome ?? 'rejected';
  const message = Object.hasOwn(messages, reason) ? messages[reason] : undefined;
  c.header('X-Sentry-Error', reason);
  return c.json({ ...result, ...(message ? { message } : {}) }, status as ContentfulStatusCode);
}
