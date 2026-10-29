import { releaseVersionKey } from './identity';
import type { ReleasePolicy } from './policy';

type ReleaseOrder = ReleasePolicy['order'];
interface OrderedRelease { name:string; seq:number; created:number; first_seen?:number|null }
const bytes=new TextEncoder();
const byteCompare=(a:string,b:string)=>{
 const left=bytes.encode(a),right=bytes.encode(b);
 for(let i=0;i<Math.min(left.length,right.length);i++)if(left[i]!==right[i])return left[i]-right[i];
 return left.length-right.length;
};
/** Each release has its own key; no comparison depends on the other name. */
export function compareReleases(a:OrderedRelease,b:OrderedRelease,order:ReleaseOrder){
 if(order==='registered')return a.seq-b.seq||byteCompare(a.name,b.name);
 if(order==='semver'){
  const left=releaseVersionKey(a.name),right=releaseVersionKey(b.name);
  const category=Number(left===null)-Number(right===null);
  if(category)return category;
  if(left!==null&&right!==null&&left!==right)return left<right?-1:1;
 }
 return (a.first_seen??a.created)-(b.first_seen??b.created)||byteCompare(a.name,b.name);
}

/** Derived ordering keys never create authoritative release metadata. The cache
 * follows release deletion, including import undo, and is rebuilt after restore. */
export const releaseOrderKeyStatement=(db:D1Database,project:string,name:string)=>db.prepare('INSERT INTO release_order_keys(project,release,version_key) VALUES(?,?,?) ON CONFLICT(project,release) DO UPDATE SET version_key=excluded.version_key').bind(project,name,releaseVersionKey(name));
export async function ensureReleaseOrderKeys(db:D1Database,project:string){
 const rows=(await db.prepare('SELECT r.name,k.release cached_release,k.version_key FROM releases r LEFT JOIN release_order_keys k ON k.project=r.project AND k.release=r.name WHERE r.project=?').bind(project).all<{name:string;cached_release:string|null;version_key:string|null}>()).results;
 const jobs=rows.flatMap(row=>row.cached_release!==null&&row.version_key===releaseVersionKey(row.name)?[]:[releaseOrderKeyStatement(db,project,row.name)]);
 for(let i=0;i<jobs.length;i+=100)await db.batch(jobs.slice(i,i+100));
 // Reindex the former pair-dependent observed watermark; resolved boundaries
 // keep their existing release identity.
 if(jobs.length)await db.prepare(`UPDATE issue_resolutions SET observed_seq=${observedReleaseSequenceSql()} WHERE project=? AND EXISTS(SELECT 1 FROM issues i WHERE i.project=issue_resolutions.project AND i.id=issue_resolutions.issue AND i.algorithm='sentry-chain-v1')`).bind(project).run();
}

export const releasePolicyOrderSql=(project:string)=>`COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=${project}),'sentry')`;
function releaseKeySql(release:string,order:string){
 const semantic=`(SELECT version_key FROM release_order_keys WHERE project=${release}.project AND release=${release}.name)`;
 return [
  `CASE WHEN ${order}='registered' THEN ${release}.seq ELSE 0 END`,
  `CASE WHEN ${order}='semver' AND ${semantic} IS NULL THEN 1 ELSE 0 END`,
  `(CASE WHEN ${order}='semver' THEN COALESCE(${semantic},'') ELSE '' END) COLLATE BINARY`,
  `CASE WHEN ${order}='registered' THEN 0 ELSE COALESCE((SELECT first_seen FROM release_metadata WHERE project=${release}.project AND release=${release}.name),${release}.created) END`,
  `${release}.name COLLATE BINARY`,
 ];
}
export function releaseOrderSql(release='releases',direction:'ASC'|'DESC'='ASC',order=releasePolicyOrderSql(release+'.project')){
 return releaseKeySql(release,order).map(key=>`${key} ${direction}`).join(',');
}
export function releaseComparisonSql(left:string,right:string,order=releasePolicyOrderSql(left+'.project')){
 return `(${releaseKeySql(left,order).join(',')})>(${releaseKeySql(right,order).join(',')})`;
}
export function latestReleaseSql(project:string,column:'name'|'seq'='name',order=releasePolicyOrderSql('ordered_release.project')){
 return `(SELECT ordered_release.${column} FROM releases ordered_release WHERE ordered_release.project=${project} ORDER BY ${releaseOrderSql('ordered_release','DESC',order)} LIMIT 1)`;
}
export function observedReleaseSequenceSql(resolution='issue_resolutions'){
 return `COALESCE((SELECT r.seq FROM releases r WHERE r.project=${resolution}.project AND (r.seq=${resolution}.observed_seq OR r.seq=(SELECT latest_release_seq FROM issues WHERE project=${resolution}.project AND id=${resolution}.issue) OR EXISTS(SELECT 1 FROM events e WHERE e.project=r.project AND e.issue=${resolution}.issue AND e.release=r.name)) ORDER BY ${releaseOrderSql('r','DESC')} LIMIT 1),0)`;
}
/** The archive/repair watermark remains numeric; only the separate observed
 * identity follows project policy. Native issue boundaries retain sequence. */
export function currentReleaseSequenceSql(issue='issues'){
 return `(CASE WHEN ${issue}.algorithm<>'sentry-chain-v1' OR ${releasePolicyOrderSql(issue+'.project')}='registered' THEN COALESCE(${issue}.latest_release_seq,${latestReleaseSql(issue+'.project','seq',"'registered'")},0)
 ELSE COALESCE((SELECT observed_seq FROM issue_resolutions WHERE project=${issue}.project AND issue=${issue}.id),${issue}.latest_release_seq,${latestReleaseSql(issue+'.project','seq')},0) END)`;
}
/** Evaluated inside admission, after auto-creation, using the same tuple as lists. */
export function newerReleaseSql(project:string,event:string,boundary:string){
 return `(${event}.release<>'' AND CASE WHEN ${boundary} IS NULL OR ${boundary}=0 THEN 1
 WHEN json_extract(${event}.payload,'$.sentry') IS NULL OR ${releasePolicyOrderSql(project)}='registered' THEN ${event}.release_seq>${boundary}
 ELSE EXISTS(SELECT 1 FROM releases candidate_release JOIN releases boundary_release ON boundary_release.project=candidate_release.project AND boundary_release.seq=${boundary} WHERE candidate_release.project=${project} AND candidate_release.name=${event}.release AND ${releaseComparisonSql('candidate_release','boundary_release',releasePolicyOrderSql(project))}) END)`;
}
export const resolvedBoundarySql=(issue='i')=>`COALESCE((SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id),${issue}.resolved_seq)`;
/** Current and already-observed named boundaries share the repeat policy.
 * Next and the first event in a future named target retain their open cut. */
export function sameResolvedReleaseSql(issue='i',event='incoming'){
 return `(${event}.release<>'' AND ${issue}.latest_release_seq IS NOT NULL AND ${event}.release_seq=${resolvedBoundarySql(issue)} AND EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id AND (resolution.mode='current' OR resolution.mode='named' AND EXISTS(SELECT 1 FROM issue_recurrence_boundaries snapshot WHERE snapshot.project=${issue}.project AND snapshot.issue=${issue}.id AND snapshot.boundary_seq=resolution.boundary_seq AND snapshot.seen_at_resolution=1))))`;
}
/** Both identities must exist: an unknown or release-less occurrence cannot
 * establish an older release. Native events keep registered-sequence order. */
export function olderResolvedReleaseSql(issue='i',event='incoming'){
 const boundary=resolvedBoundarySql(issue);
 return `(${event}.release<>'' AND ${event}.release_seq<>${boundary} AND EXISTS(SELECT 1 FROM releases boundary_release WHERE boundary_release.project=${issue}.project AND boundary_release.seq=${boundary}) AND EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id AND resolution.mode IN ('current','next','named')) AND NOT ${newerReleaseSql(issue+'.project',event,boundary)})`;
}
export function regressionSql(issue='i',event='incoming'){
 const resolution=`(SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id)`;
 return `(EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id AND resolution.mode='plain') OR (${issue}.latest_release_seq IS NOT NULL AND (${newerReleaseSql(issue+'.project',event,`COALESCE(${resolution},${issue}.resolved_seq)`)} OR (${event}.release<>'' AND EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id AND resolution.mode='named' AND resolution.boundary_seq=${event}.release_seq AND NOT ${sameResolvedReleaseSql(issue,event)})) OR (${sameResolvedReleaseSql(issue,event)} AND EXISTS(SELECT 1 FROM recurrence_policies recurrence WHERE recurrence.project=${issue}.project AND recurrence.reopen_same_release=1)))))`;
}
