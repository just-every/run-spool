import { safeAlias } from '../audit/types';
import { emailPreferences } from './model';

export const notificationPreferenceTables = {spool_notification_preferences:['project','actor_label','operator_id','email','revision','updated','historical']};
export const notificationPreferenceDefaults = (data:any) => ({spool_notification_preferences:[],...data});
export const notificationPreferenceExportRow = (table:string,row:any) => table === 'spool_notification_preferences' ? {...row,operator_id:null,historical:1} : row;
export function validateNotificationPreferences(data:any) {
 const seen = new Set<string>();
 for (const row of data.spool_notification_preferences) {
  const key = JSON.stringify([row.project,row.actor_label]);
  if (!safeAlias(row.actor_label) || row.operator_id !== null || row.historical !== 1 || seen.has(key) ||
   !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.updated) || row.updated < 0) throw new Error('Invalid notification preference archive');
  seen.add(key);
  if (JSON.stringify(emailPreferences(JSON.parse(row.email))) !== row.email) throw new Error('Invalid notification preference archive');
 }
}
