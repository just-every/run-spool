/** Commit author and message are personal data. They leave the owner session (packets,
 * agent reads, alerts, exports) only when the owner turns on this audited per-project
 * choice; it is off until then. SHA, citation, release and PR always travel. */
export const sharingSql = (project: string) => `COALESCE((SELECT share FROM commit_sharing WHERE project=${project}),0)=1`;
export async function commitSharing(db: D1Database, project: string) {
 const row = await db.prepare('SELECT share,revision,updated FROM commit_sharing WHERE project=?').bind(project).first<{ share: number; revision: number; updated: number }>();
 return { share: row?.share === 1, revision: row?.revision ?? 0, updated: row?.updated ?? null };
}
export const commitLinkSql = (project: string, issue: string) => `SELECT l.sha,l.citation,l.short_id,l.linked,l.release,l.resolved,l.pr,c.author_name,c.author_email,c.message,c.expired
 FROM commit_links l JOIN commits c ON c.project=l.project AND c.sha=l.sha WHERE l.project=${project} AND l.issue=${issue} ORDER BY l.linked DESC,l.sha LIMIT 20`;
export function sharedCommit(row: any, share: boolean) {
 return { sha: row.sha, citation: row.citation, shortId: row.short_id, linked: row.linked, release: row.release ?? null, resolved: row.resolved ?? null, pr: row.pr ?? null,
  ...(share ? { author: row.expired === null && (row.author_name !== null || row.author_email !== null) ? { name: row.author_name, email: row.author_email } : null, message: row.expired === null ? row.message : null } : {}) };
}

// A regression of an issue whose current resolution came from a commit names that commit:
// SHA, release and PR always; author and message only by the owner's sharing choice.
export const commitResolutionSql = (issue: string) => `(SELECT CASE WHEN ${sharingSql('l.project')} AND c.expired IS NULL
  THEN json_object('release',l.release,'commit',l.sha,'pr',l.pr,'author',json_object('name',c.author_name,'email',c.author_email),'message',substr(c.message,1,1000))
  ELSE json_object('release',l.release,'commit',l.sha,'pr',l.pr) END
 FROM commit_links l JOIN commits c ON c.project=l.project AND c.sha=l.sha JOIN issue_resolutions z ON z.project=l.project AND z.issue=l.issue
 WHERE l.project=${issue}.project AND l.issue=${issue}.id AND z.mode='named' AND z.updated=l.resolved ORDER BY l.resolved DESC,l.sha LIMIT 1)`;
