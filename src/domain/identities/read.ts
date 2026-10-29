import {readIdentityPolicy,identityFields} from './policy';
// The SDK-008 key definition is shared by issue reads, reports and widgets.
// Aliases are code-owned SQL identifiers; never pass request text here.
export const eventUserKeySql=(event='e',identity='x')=>`COALESCE(${identity}.user_key,CASE WHEN json_extract(${event}.payload,'$.sentry') IS NULL AND json_extract(${event}.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(${event}.payload,'$.client') END)`;
export async function affectedUsers(db:D1Database,project:string,issue:string){
 const [counts,snapshot]=await Promise.all([db.prepare(`SELECT COUNT(*) events,COUNT(DISTINCT ${eventUserKeySql()}) users,SUM(CASE WHEN ${eventUserKeySql()} IS NULL THEN 1 ELSE 0 END) unattributed FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=? AND e.issue=?`).bind(project,issue).first<any>(),readIdentityPolicy(db,project)]);
 return {affectedUsers:counts.users||null,events:counts.events,unattributed:counts.unattributed??0,reason:counts.users?'Known retained user keys only':identityFields.every(f=>snapshot.policy[f]==='drop')?'unavailable (policy: drop)':'unavailable (SDK identity absent, previously dropped, or connecting-client address unavailable)',definition:'First retained Sentry id, email, username or literal ip_address after policy; native Spool events use their bounded random client identifier; keyed project hashes define equal values. Forwarded addresses never resolve {{auto}}.'};
}
