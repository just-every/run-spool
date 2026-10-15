import type { Bindings } from '../auth/bindings';
import type { AlertEnvironment } from '../domain/alerts/types';

export const demoProject = 'cedar-market';

/** Deployment-owned destinations in the disposable demo; never install an egress transport. */
export function demoEnvironment(env: Bindings): Bindings & AlertEnvironment {
 if (env.RER_DEMO !== '1') return env;
 // Each demo already has its own session secret. Derive only a local destination
 // integrity key; neither this key nor the sample webhook can deliver anything.
 const key = btoa(env.SESSION_SECRET);
 return { ...env, MAIL_PROVIDER: 'development', MAIL_FROM: 'Spool demo <demo@demo.invalid>',
  MAIL_API_KEY: undefined, MAIL_ACCOUNT_ID: undefined, INTEGRATION_EGRESS: undefined,
  ALERT_PUBLIC_ORIGIN: env.AUTH_ORIGIN, ALERT_DESTINATION_HASH_KEY: key,
  ALERT_DESTINATIONS: JSON.stringify([
   { id: 'demo-mail', project: demoProject, label: 'Demo owner outbox', channel: 'mail', recipient: env.OWNER_EMAIL },
   { id: 'demo-webhook', project: demoProject, label: 'Demo webhook (egress disabled)', channel: 'webhook', url: 'https://hooks.example.com/spool-demo', key },
  ]),
 };
}
