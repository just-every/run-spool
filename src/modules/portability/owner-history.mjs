import { ledgerNames, readLedger } from './ledgers.mjs';
import { all, insist, quote } from './storage.mjs';

export function ownerMigrationPolicy(policy, sources) {
 if (!sources.length) return policy;
 const tables = sources.map(source => source.table);
 insist(!policy.includeTables?.some(name => tables.includes(name.toLowerCase())), 'migration_ledger:incompatible', 409);
 return { ...policy, excludeTables: [...new Set([...(policy.excludeTables ?? []), ...tables])] };
}

const ownerColumns = columns => columns.length === 3 && columns[0].name === 'id' && columns[0].pk === 1
 && columns[1].name === 'name' && columns[2].name === 'applied_at';
const timestamp = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/;
async function nativeRows(db, table, owner = false) {
 const columns = await all(db, `PRAGMA table_info(${quote(table)})`);
 if (!columns.length) return [];
 insist(owner ? ownerColumns(columns) : ownerColumns(columns.slice(0, 3)), 'migration_ledger:incompatible', 409);
 const rows = await all(db, `SELECT name, applied_at FROM ${quote(table)} ORDER BY id`);
 insist(new Set(rows.map(row => row.name)).size === rows.length
  && rows.every((row, i) => typeof row.name === 'string' && timestamp.test(row.applied_at)
   && (!i || rows[i - 1].applied_at <= row.applied_at)), 'migration_ledger:incompatible', 409);
 return rows;
}

export async function nativeMigrationHistory(db, sources) {
 const ledger = await readLedger(db);
 const owners = (await Promise.all(sources.map(async ({ table, prefix }) =>
  (await nativeRows(db, table, true)).map(row => ({ ...row, name: prefix + row.name, table }))))).flat();
 if (!owners.length) return ledger;
 insist(ledger?.table === 'd1_migrations', 'migration_ledger:multiple', 409);
 const core = (await nativeRows(db, ledger.table)).map((row, i) => ({ ...ledger.entries[i], applied_at: row.applied_at, table: ledger.table }));
 const rows = [...core, ...owners].sort((a, b) => a.applied_at.localeCompare(b.applied_at));
 // IDs order each ledger. Across ledgers equal timestamps carry no order.
 insist(rows.every((row, i) => !i || row.applied_at !== rows[i - 1].applied_at || row.table === rows[i - 1].table), 'migration_ledger:uncertain', 409);
 const entries = rows.map(({ name, sha256, table }) => ({ name, table, ...(sha256 ? { sha256 } : {}) }));
 insist(new Set(entries.map(row => row.name)).size === entries.length, 'migration_ledger:ambiguous', 409);
 return { table: ledger.table, entries, owners: true };
}

export function requireAppliedOwnerFiles(history, files) {
 if (!history?.owners) return;
 const names = new Set(files.map(file => file.name));
 insist(history.entries.every(row => row.table === history.table || names.has(row.name)),
  'schema_mismatch:owner_migration_history', 409);
}

// The existing service callback is also used for core-only replay. Consult it
// early only when native owner bookkeeping may exist. The replay supplies the
// declared table identities; a similar product table never becomes bookkeeping.
async function hasOwnerLedger(db) {
 const candidates = await all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name GLOB '[a-z]*_*_migrations'");
 for (const { name } of candidates) {
  if (!ledgerNames.includes(name) && ownerColumns(await all(db, `PRAGMA table_info(${quote(name)})`))) return true;
 }
 return false;
}

export async function transferHistory({ db, config, migrations, migrationHistory }) {
 if (migrationHistory) return { config, migrations, ledger: await migrationHistory() };
 const ledger = await readLedger(db);
 if (migrations && ledger?.table === 'd1_migrations' && await hasOwnerLedger(db)) {
  const replay = await migrations();
  if (replay?.ownerSources) return {
   config: ownerMigrationPolicy(config, replay.ownerSources), migrations: async () => replay, ledger: replay.history,
  };
  return { config, migrations: async () => replay, ledger };
 }
 return { config, migrations, ledger };
}
