import { all, quote, insist } from './storage.mjs';
import { catalogue, policy } from './catalogue.mjs';
import { migrationSeeded } from './restore-safety.mjs';

// Runner preflight before creating a restore job. Finalize repeats its atomic
// empty-table guards; this early read keeps an occupied destination untouched.
export async function requireEmptyTables({ db, policy: input, migrations }) {
 const config = policy(input), cat = await catalogue(db, config), filled = [];
 for (const table of cat.tables) if (!config.replaceableTables.includes(table.name) && (await all(db, `SELECT 1 FROM ${quote(table.name)} LIMIT 1`)).length) filled.push(table.name);
 const seeded = await migrationSeeded(db, filled, migrations);
 for (const name of filled) insist(seeded.some(table => table.name === name), 'target_not_empty:' + name, 409);
}
