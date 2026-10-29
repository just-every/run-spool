import { sqliteTokens } from './sqlite-tokens.mjs';
import { canonicalJson, sha256 } from './hash.mjs';

// Read-only wire codecs for 4280971d/537b088b/9352a46d checksums. These
// lossy representations authenticate historical manifests ONLY; they never
// decide whether two schemas match. All compatibility uses schemaIdentityOf.
function legacySQL(sql) {
 return canonicalJson(sqliteTokens(sql).flatMap(token => {
  if (token.type === 'blob') return [token.text[0], token.text.slice(1)];
  if (token.type === 'quoted-identifier' || token.type === 'string') return [token.text];
  return token.text.match(/[\p{L}\p{N}_$]+|->>|->|==|!=|<>|<=|>=|<<|>>|\|\||./gu);
 }));
}
export const rawSchemaIdentityOf = tables => sha256(canonicalJson(tables.map(({name,sql}) => ({name,sql}))));
export async function legacySchemaIdentities(tables, objects = []) {
 const definitions = tables.map(({name,sql}) => ({name,sql:legacySQL(sql)}));
 return Promise.all([
  sha256(canonicalJson(definitions)),
  sha256(canonicalJson({tables:definitions,objects:objects.map(({name,type,table,sql}) => ({name,type,table,sql:legacySQL(sql)}))})),
 ]);
}
