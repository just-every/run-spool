import type { TrustedTransport } from '../../modules/integrations/core/types';
export type AlertKind = 'new_issue' | 'regression' | 'reactivation' | 'spike';
export type AlertEnvironment = {
 DB: D1Database; ALERT_DESTINATIONS?: string; ALERT_PUBLIC_ORIGIN?: string;
 ALERT_DESTINATION_HASH_KEY?: string; INTEGRATION_EGRESS?: TrustedTransport;
 SLACK_TIMEOUT_MS?: string; SENDGRID_EVENT_PUBLIC_KEY?: string; ALERT_EVENT_PROVENANCE?: string;
 MAIL_PROVIDER?: string; MAIL_FROM?: string; MAIL_API_KEY?: string; MAIL_ACCOUNT_ID?: string; MAIL_RELAY_URL?: string;
 AUTH_LOCAL?: string; AUTH_ORIGIN?: string; RER_DEMO?: string;
};
export type Rule = { id:string; project:string; revision:number; name:string; enabled:number;
 channel:'mail'|'webhook'; destination:string; kinds:string; window_ms:number; threshold:number; created:number; updated:number; config:string };
export type Intent = { id:string; project:string; alert_id:string; rule_id:string; rule_revision:number;
 channel:'mail'|'webhook'; destination:string; body:string; event:string; created:number; state:string; code:string|null; expanded:number };
export const statement = (db:D1Database, sql:string, ...args:(string|number|null)[]) => db.prepare(sql).bind(...args);
export const namespace = (project:string) => `spool.${project}`;
