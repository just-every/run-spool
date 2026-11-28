import { demoEffect } from '../modules/demo/index.mjs';
import type { Bindings } from '../auth/bindings';
import type { AlertEnvironment } from '../domain/alerts/types';

export const demoProject = 'cedar-market';

/** Deployment-owned destinations in the disposable demo; with demo effects handled at their transport boundary. */
export function demoEnvironment(env: Bindings & AlertEnvironment): Bindings & AlertEnvironment {
 if (env.RER_DEMO !== '1') return env;
 // Each demo already has its own session secret. Derive only a local destination
 // integrity key; neither this key nor the sample webhook can deliver anything.
 const key = btoa(env.SESSION_SECRET);
 return { ...env,
  // Worker Loader supplies one origin for both the visitor app and its signed claim.
  ...(env.RER_OWNER_CLAIM_ISSUER ? { RER_OWNER_CLAIM_APP_ORIGIN: env.AUTH_ORIGIN } : {}),
  MAIL_PROVIDER: 'development', MAIL_FROM: 'Spool demo <demo@demo.invalid>',
  MAIL_API_KEY: undefined, MAIL_ACCOUNT_ID: undefined, INTEGRATION_EGRESS: { send: request => demoEffect(() => {
   if (!env.INTEGRATION_EGRESS) throw new Error('egress_unconfigured');
   return env.INTEGRATION_EGRESS.send(request);
  }, () => ({ status: 204, headers: {}, body: '' })) },
  ALERT_PUBLIC_ORIGIN: env.AUTH_ORIGIN, ALERT_DESTINATION_HASH_KEY: key,
  ALERT_DESTINATIONS: JSON.stringify([
   { id: 'demo-mail', project: demoProject, label: 'Demo owner email', channel: 'mail', recipient: env.OWNER_EMAIL },
   { id: 'demo-webhook', project: demoProject, label: 'Demo webhook', channel: 'webhook', url: 'https://hooks.example.com/spool-demo', key },
  ]),
 };
}
