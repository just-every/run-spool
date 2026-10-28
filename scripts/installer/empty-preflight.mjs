import { appliedMigrations, platformMigrationDeclaration } from '@runeditrun/rer/portability-migrations';
import { migrationReplay } from '../../src/modules/portability/migration-history.mjs';
import { splitStatements } from '../../src/modules/portability/sql-text.mjs';
import { requireEmptyTables } from '../../src/modules/portability/restore-empty.mjs';
import policy from './managed-data-policy.mjs';

// Recovery supplies its private read-only snapshot. Refuse an occupied
// destination before opening a writable D1 runtime, which can checkpoint an
// otherwise unchanged database.
export async function emptyPreflight(root, snapshot) {
 const db = { prepare(sql) { const statement = snapshot.prepare(sql); let values = []; return {
  bind(...args) { values = args; return this; },
  async all() { return { results: statement.all(...values) }; },
  async first() { return statement.get(...values) ?? null; },
 }; } };
 const declaration = platformMigrationDeclaration();
 const migrations = async () => migrationReplay(await appliedMigrations(root, db, 'DB', declaration, splitStatements), policy, declaration);
 await requireEmptyTables({ db, policy, migrations });
}
