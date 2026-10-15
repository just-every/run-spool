import { stmt } from '../admission';
import type { Exposure } from './report';

const CAPACITY = 20000;

// Keep the migration's hard capacity trigger as the final backstop. UPDATE
// existing identities first: SQLite runs BEFORE INSERT even for an UPSERT that
// would only update, so an UPSERT cannot refresh a client at the full cap.
export function exposureStatements(db: D1Database, project: string, report: Exposure, time: number) {
 const flows = JSON.stringify(['', ...report.flows]);
 return [
  stmt(db, `UPDATE exposures SET reports=reports+1,last=MAX(last,?),capture=MIN(capture,?)
   WHERE project=? AND release=? AND environment=? AND client=? AND flow IN (SELECT value FROM json_each(?))`,
   time, report.capture ? 1 : 0, project, report.release, report.environment, report.client, flows),
  // Work out the missing identities inside the same transaction. Never evict
  // an identity being refreshed by this report, even when its clock is older.
  stmt(db, `DELETE FROM exposures WHERE project=? AND rowid IN (
   SELECT rowid FROM exposures WHERE project=? AND NOT (release=? AND environment=? AND client=? AND flow IN (SELECT value FROM json_each(?)))
   ORDER BY last,first,release,environment,flow,client LIMIT MAX(0,
    (SELECT COUNT(*) FROM exposures WHERE project=?)+
    (SELECT COUNT(*) FROM json_each(?) f WHERE NOT EXISTS(SELECT 1 FROM exposures x WHERE x.project=? AND x.release=? AND x.environment=? AND x.client=? AND x.flow=f.value))-?))`,
   project, project, report.release, report.environment, report.client, flows,
   project, flows, project, report.release, report.environment, report.client, CAPACITY),
  // This must immediately follow DELETE: changes() is the actual eviction
  // count, rather than a preflight estimate that can race another admission.
  stmt(db, `INSERT INTO outcomes SELECT ?,?,'exposure_evicted',changes() WHERE changes()>0
   ON CONFLICT(project,window,reason) DO UPDATE SET count=count+excluded.count`, project, Math.floor(time / 60000) * 60000),
  stmt(db, `INSERT INTO exposures(project,release,environment,flow,client,capture,reports,first,last)
   SELECT ?,?,?,f.value,?,?,1,?,? FROM json_each(?) f
   WHERE NOT EXISTS(SELECT 1 FROM exposures x WHERE x.project=? AND x.release=? AND x.environment=? AND x.client=? AND x.flow=f.value)`,
   project, report.release, report.environment, report.client, report.capture ? 1 : 0, time, time, flows,
   project, report.release, report.environment, report.client),
 ];
}
