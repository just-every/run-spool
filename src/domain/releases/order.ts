/** Release comparisons are evaluated inside the admission transaction, after
 * auto-creation. The independent numeric watermark remains intact for native
 * archives and repair coverage; it is never rewritten into a semantic rank. */
export function newerReleaseSql(project:string,event:string,boundary:string){
 return `(${event}.release<>'' AND CASE WHEN ${boundary} IS NULL OR ${boundary}=0 THEN 1
 WHEN json_extract(${event}.payload,'$.sentry') IS NULL OR COALESCE((SELECT json_extract(policy,'$.order') FROM release_policies WHERE project=${project}),'sentry')='registered' THEN ${event}.release_seq>${boundary}
 WHEN (SELECT version_key FROM release_metadata WHERE project=${project} AND release=${event}.release) IS NOT NULL AND (SELECT version_key FROM release_metadata m JOIN releases r ON r.project=m.project AND r.name=m.release WHERE r.project=${project} AND r.seq=${boundary}) IS NOT NULL THEN
 (SELECT version_key FROM release_metadata WHERE project=${project} AND release=${event}.release)>(SELECT version_key FROM release_metadata m JOIN releases r ON r.project=m.project AND r.name=m.release WHERE r.project=${project} AND r.seq=${boundary})
 ELSE ${event}.release_seq>${boundary} END)`;
}
export function regressionSql(issue='i',event='incoming'){
 const resolution=`(SELECT boundary_seq FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id)`;
 return `(EXISTS(SELECT 1 FROM issue_resolutions resolution WHERE resolution.project=${issue}.project AND resolution.issue=${issue}.id AND resolution.mode='plain') OR (${issue}.latest_release_seq IS NOT NULL AND ${newerReleaseSql(issue+'.project',event,`COALESCE(${resolution},${issue}.resolved_seq)`)}))`;
}
