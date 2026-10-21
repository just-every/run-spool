import { withdrawCommitIdentity } from '../alerts/retention';

/** Commit author and message expire with the project's retention cutoff: every commit
 * received before it keeps its SHA, links and resolution, and loses its personal text,
 * including the copies a shared alert carried. */
export function commitRetentionStatements(db: D1Database, project: string, cutoff: number, time: number) {
 return [
  db.prepare('UPDATE commits SET message=NULL,author_name=NULL,author_email=NULL,expired=? WHERE project=? AND received<? AND expired IS NULL AND COALESCE(message,author_name,author_email) IS NOT NULL').bind(cutoff, project, cutoff),
  ...withdrawCommitIdentity(db, project, time),
 ];
}
