/** Destination custody never travels in an archive; each restore establishes it anew. */
export async function restoredWork(db: D1Database, project: string, kind: 'repair' | 'run' | 'fix', record: string) {
 return !!await db.prepare('SELECT 1 FROM restored_work WHERE project=? AND kind=? AND record=?').bind(project, kind, record).first();
}
export const RESTORED_WORK_REASON = 'Restored history has no current repair proof or active grant. Queue a fresh sandbox run or record a new repair in this installation.';
