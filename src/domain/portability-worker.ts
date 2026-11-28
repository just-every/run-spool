import { workerMigrations } from '@runeditrun/rer/modules/portability/worker-history';
import { portability as archivePortability } from './portability';

// The Worker uses build-owned history; Node callers retain checkout-owned replay.
export function portability(db: D1Database, safeAudit = true) {
 return archivePortability(db, safeAudit, async (database, policy) => {
  const {default:evidence}=await import('virtual:rer-legacy-migration-evidence');
  return workerMigrations(database, policy, evidence);
 });
}
