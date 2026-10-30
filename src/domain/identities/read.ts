import {readIdentityPolicy,identityFields} from './policy';
// The SDK-008 key definition is shared by issue reads, reports and widgets.
// Aliases are code-owned SQL identifiers; never pass request text here.
export const eventUserKeySql=(event='e',identity='x')=>`COALESCE(${identity}.user_key,CASE WHEN json_extract(${event}.payload,'$.sentry') IS NULL AND json_extract(${event}.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(${event}.payload,'$.client') END)`;
export async function affectedUsers(db:D1Database,project:string,issue:string){
 return (await affectedUsersByIssue(db,project,[issue])).get(issue)!;
}
// Count only the selected issue page, across each issue's whole retained corpus.
// No identity values or hashes leave this aggregate read.
export async function affectedUsersByIssue(db:D1Database,project:string,issues:string[]){
 const result=new Map<string,{affectedUsers:number|null;events:number;unattributed:number;reason:string;definition:string}>();
 if(!issues.length)return result;
 const [rows,snapshot]=await Promise.all([db.prepare(`SELECT e.issue,COUNT(*) events,COUNT(DISTINCT ${eventUserKeySql()}) users,SUM(CASE WHEN ${eventUserKeySql()} IS NULL THEN 1 ELSE 0 END) unattributed FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=? AND e.issue IN (SELECT value FROM json_each(?)) GROUP BY e.issue`).bind(project,JSON.stringify(issues)).all<any>(),readIdentityPolicy(db,project)]);
 const counts=new Map(rows.results.map(row=>[row.issue,row]));
 for(const issue of issues){
  const row=counts.get(issue);
  result.set(issue,{affectedUsers:row?.users||null,events:row?.events??0,unattributed:row?.unattributed??0,reason:row?.users?'Known retained user keys only':identityFields.every(f=>snapshot.policy[f]==='drop')?'unavailable (policy: drop)':'unavailable (SDK identity absent, previously dropped, or connecting-client address unavailable)',definition:'First retained Sentry id, email, username or literal ip_address after policy; native Spool events use their bounded random client identifier; keyed project hashes define equal values. Forwarded addresses never resolve {{auto}}.'});
 }
 return result;
}
