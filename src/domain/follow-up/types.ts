import type { AlertEnvironment } from '../alerts/types';
export type Environment = AlertEnvironment;
export const s = (db:D1Database,sql:string,...args:any[]) => db.prepare(sql).bind(...args);
export type Attention = {
 id:string; project:string; source:'alert'|'deployment'|'fix'; source_id:string;
 owner:string; due:number; state:string; reason:string; revision:number;
 created:number; updated:number; historical:number;
};
export const followUpExcludedTables = ['follow_up_settings','follow_up_feed_custody','follow_up_attention','follow_up_notices','follow_up_notice_meta','follow_up_attempts','follow_up_fix_steps','follow_up_deployment_attempts'];

// These receipts describe successful storage, an idempotent retry, an owner
// withdrawal, or successful forwarding. Keep real refusals, trimming and SDK
// discards in the existing loss path, including unknown unsupported item types.
export const nonLossOutcomes = [
 'accepted','duplicate','feedback_accepted','feedback_duplicate','feedback_withdrawn',
 'session_stored','check_in_routed',
 'sentry_release_invalid_release_name','sentry_release_automatic_release_pattern',
] as const;
export const isCaptureLoss = (reason:string) => !(nonLossOutcomes as readonly string[]).includes(reason);
