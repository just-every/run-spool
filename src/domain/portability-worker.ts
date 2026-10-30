import evidence from 'virtual:rer-legacy-migration-evidence';
import { workerMigrations } from '@runeditrun/rer/modules/portability/worker-history';
import { portability as archivePortability } from './portability';

// The Worker uses build-owned history; Node callers retain checkout-owned replay.
export function portability(db: D1Database, safeAudit = true) {
 return archivePortability(db, safeAudit, (database, policy) => workerMigrations(database, policy, evidence));
}
