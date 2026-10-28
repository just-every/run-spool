import { splitStatements } from './sql-text.mjs';

// Use the installation's migration runner to reproduce the text it stores in
// sqlite_master (including its comment handling). Then recover SQLite's own
// boundaries: Wrangler can glue a CASE ... END trigger to later statements.
export function migrationStatements(sql, runnerSplit) {
  return runnerSplit(sql).flatMap(splitStatements);
}
