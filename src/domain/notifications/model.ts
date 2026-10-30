import { AuthError } from '../../modules/operator-auth/index.mjs';

import { notificationTypes, type EmailPreferences } from './types';
export const defaultEmailPreferences = (): EmailPreferences => Object.fromEntries(notificationTypes.map(type => [type, false])) as EmailPreferences;
export function emailPreferences(value: unknown): EmailPreferences {
 if (!value || typeof value !== 'object' || Array.isArray(value) ||
  Object.keys(value).sort().join() !== [...notificationTypes].sort().join() ||
  Object.values(value).some(enabled => typeof enabled !== 'boolean')) throw new AuthError('invalid_notification_preferences',400);
 return Object.fromEntries(notificationTypes.map(type => [type, (value as EmailPreferences)[type]])) as EmailPreferences;
}

export async function readPreferences(db: D1Database, project: string, operator: string) {
 const row = await db.prepare('SELECT email,revision,updated FROM spool_notification_preferences WHERE project=? AND operator_id=? AND historical=0').bind(project,operator).first<{email:string;revision:number;updated:number}>();
 return row ? {email:emailPreferences(JSON.parse(row.email)),revision:row.revision,updated:row.updated} : {email:defaultEmailPreferences(),revision:0,updated:null};
}

export async function readDigestSettings(db:D1Database,project:string,operator:string) {
 const row=await db.prepare('SELECT timezone,hour,daily,weekly,revision FROM spool_personal_digest_settings WHERE project=? AND operator_id=? AND historical=0').bind(project,operator).first<any>();
 return row?{...row,daily:!!row.daily,weekly:!!row.weekly}:{timezone:'UTC',hour:9,daily:false,weekly:false,revision:0};
}
