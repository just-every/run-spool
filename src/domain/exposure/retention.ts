import { tombstone } from '../../modules/portability/journal.mjs';
import { statement } from '../../modules/portability/storage.mjs';

export async function retentionExposureStatements(db: D1Database, source: string, project: string, cutoff: number, time: number) {
 // Exposure keys are deliberately reusable aggregates, without event-style
 // occurrence identities. Fence the old source checkpoint instead of banning
 // a client/flow key from every future archive after it reports again.
 const checkpoint = await tombstone(source, 'rer_portability_state', { id: 1 });
 return [
  statement(db, `INSERT OR IGNORE INTO rer_portability_journal SELECT ?,?
   WHERE EXISTS(SELECT 1 FROM exposures WHERE project=? AND last<?)`, source, checkpoint, project, cutoff),
  statement(db, 'DELETE FROM exposures WHERE project=? AND last<?', project, cutoff),
  statement(db, `INSERT INTO outcomes SELECT ?,?,'exposure_retention',changes() WHERE changes()>0
   ON CONFLICT(project,window,reason) DO UPDATE SET count=count+excluded.count`, project, Math.floor(time / 60000) * 60000),
 ];
}
