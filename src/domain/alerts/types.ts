import type { TrustedTransport } from '../../modules/integrations/core/types';
// The kinds admission and spike evaluation write; archive validation reads the same list.
export const alertKinds = ['new_issue', 'regression', 'reactivation', 'spike', 'metric'] as const;
export type AlertKind = typeof alertKinds[number];
export type AlertEnvironment = {
 DB: D1Database; ALERT_DESTINATIONS?: string; ALERT_PUBLIC_ORIGIN?: string;
 ALERT_DESTINATION_HASH_KEY?: string; INTEGRATION_EGRESS?: TrustedTransport;
 SLACK_TIMEOUT_MS?: string; SENDGRID_EVENT_PUBLIC_KEY?: string; ALERT_EVENT_PROVENANCE?: string;
 MAIL_PROVIDER?: string; MAIL_RECIPIENTS?: string; MAIL_FROM?: string; MAIL_API_KEY?: string; MAIL_ACCOUNT_ID?: string; MAIL_RELAY_URL?: string;
 AUTH_LOCAL?: string; AUTH_ORIGIN?: string; RER_DEMO?: string;
};
export type Rule = { id:string; project:string; revision:number; name:string; enabled:number;
 channel:'mail'|'webhook'; destination:string; kinds:string; window_ms:number; threshold:number; created:number; updated:number; config:string };
export type Intent = { id:string; project:string; alert_id:string; rule_id:string; rule_revision:number;
 channel:'mail'|'webhook'; destination:string; body:string; event:string; created:number; state:string; code:string|null; expanded:number };
export const statement = (db:D1Database, sql:string, ...args:(string|number|null)[]) => db.prepare(sql).bind(...args);
export const namespace = (project:string) => `spool.${project}`;
export const configSql="COALESCE((SELECT config FROM alert_rule_configs cfg WHERE cfg.rule_id=r.id),'{\"metric\":\"count\",\"filters\":{},\"tagKeys\":[]}')";
export const holdable=`(i.expanded=0 AND i.state IN ('pending','blocked') OR EXISTS(SELECT 1 FROM alert_mail_jobs j WHERE j.id=i.id AND j.state='queued') OR EXISTS(SELECT 1 FROM integration_deliveries d WHERE d.namespace='spool.'||i.project AND d.id=i.id AND d.state='queued'))`;

export type QueuedAlertMail = Pick<Intent, 'id' | 'project' | 'rule_id' | 'rule_revision' | 'destination' | 'channel'> & {
 message: string; destination_hash: string; attempts: number; max_attempts: number; retry_delays: string; standing: number;
};
export type PendingAlertIntent = Intent & {unresolved_mail:number};
export type MailIntent = Intent & {channel:'mail'};
export type MailExpansionIntent = PendingAlertIntent & MailIntent;
export type ExpansionCheckpoint = {final:boolean;previous?:string;advanceProject:boolean};
export type MailDeliveryWork = {
 deliverMail(jobs: QueuedAlertMail[], time: number, started: number): Promise<void>;
};
export type ImmediateAlertWork = MailDeliveryWork & {
 expandAdmittedMail(intents: MailIntent[]): Promise<void>;
};
export type ScheduledAlertWork = MailDeliveryWork & {
 spikes(time: number, lastRule: string): Promise<boolean>;
 expandMail(project: string, intents: MailExpansionIntent[], time: number, started: number, checkpoint:ExpansionCheckpoint): Promise<{changed:boolean;mail:boolean}>;
};
