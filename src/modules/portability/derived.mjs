import { all, quote } from './storage.mjs';
import { sqliteTokens, asciiFold } from './sqlite-tokens.mjs';

const value = token => {
  const text = token?.text ?? '', delimiter = text[0];
  return ['"', "'", '`', '['].includes(delimiter)
    ? text.slice(1, -1).replaceAll(delimiter + delimiter, delimiter) : text;
};

// Only external-content FTS5 has SQLite's native rebuild contract: its rows
// come from the migrated content table. Other derived data remains seed-owned.
function externalFts5(sql) {
  const tokens = sqliteTokens(sql), words = tokens.map(token => asciiFold(token.text));
  if (words.slice(0, 3).join(' ') !== 'create virtual table') return false;
  const using = words.indexOf('using');
  if (using < 0 || asciiFold(value(tokens[using + 1])) !== 'fts5') return false;
  let depth = 0;
  for (let i = using + 2; i < tokens.length; i++) {
    if (tokens[i].text === '(') depth++;
    else if (tokens[i].text === ')') depth--;
    else if (depth === 1 && ['(', ','].includes(tokens[i - 1]?.text)
      && asciiFold(value(tokens[i])) === 'content' && tokens[i + 1]?.text === '=')
      return value(tokens[i + 2]).length > 0;
  }
  return false;
}

export async function rebuildDerivedStatements(db, config) {
  if (!config.derivedTables.length) return [];
  const objects = await all(db, "SELECT name,sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name");
  return objects.filter(object => config.derivedTables.includes(object.name) && !config.includeTables.includes(object.name) && externalFts5(object.sql))
    .map(object => db.prepare(`INSERT INTO ${quote(object.name)}(${quote(object.name)}) VALUES('rebuild')`));
}
