import { tombstone, journal } from '../modules/portability/journal.mjs';
import { PortabilityError } from '../modules/portability/index.mjs';

export const occurrenceTables = ['events', 'artifacts'] as const;
export type OccurrenceTable = typeof occurrenceTables[number];
export const occurrenceKeys = {
 events: ['project', 'id', 'occurrence'],
 artifacts: ['project', 'release', 'build', 'debug', 'occurrence'],
};
export function occurrenceKey(table: OccurrenceTable, row: Record<string, unknown>, legacy = false) {
 return Object.fromEntries(occurrenceKeys[table].filter(key => !legacy || key !== 'occurrence').map(key => [key, row[key]]));
}
export function upgradeOccurrence<T extends Record<string, unknown>>(table: string, row: T) {
 return occurrenceTables.includes(table as OccurrenceTable) ? { ...row, occurrence: 'legacy' } : row;
}
export function validateOccurrence(value: unknown) {
 if (value !== 'legacy' && (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value))) throw new Error('Archive occurrence identity');
}
// Base continues to fence the complete current primary key. Legacy occurrences
// additionally retain the old key fence; a schema upgrade never clears erasure.
export async function fenceLegacyOccurrences(db: D1Database, manifest: any, data: Record<string, any[]>, later: string[] = []) {
 const erased = new Set([...manifest.journal, ...await journal(db, manifest.sourceIdentity), ...later]);
 for (const table of occurrenceTables) for (const row of data[table]) {
  if (row.occurrence === 'legacy' && erased.has(await tombstone(manifest.sourceIdentity, table, occurrenceKey(table, row, true)))) throw new PortabilityError('erased_row:' + table);
 }
}
