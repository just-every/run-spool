import { canonicalTokens } from './sqlite-tokens.mjs';
import { canonicalJson, sha256 } from './hash.mjs';
export { rawSchemaIdentityOf } from './schema-legacy.mjs';

// Typed, lossless lexical identity. Only trivia and proven-safe keyword case
// are normalized; the same lexer proves every removed separator is harmless.
export const schemaSQL = sql => canonicalJson(canonicalTokens(sql));
const tableDefinitions = tables => tables.map(({ name, sql }) => ({ name, sql: schemaSQL(sql) }));
export const schemaIdentityOf = (tables, objects = []) => sha256(canonicalJson({
 tables: tableDefinitions(tables),
 objects: objects.map(({ name, type, table, sql }) => ({ name, type, table, sql: schemaSQL(sql) })),
}));
export const tableSchemaIdentityOf = tables => sha256(canonicalJson(tableDefinitions(tables)));
