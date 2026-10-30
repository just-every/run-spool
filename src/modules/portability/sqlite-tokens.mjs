import { insist } from './storage.mjs';

// SQLite's public-domain sqlite3GetToken (src/tokenize.c). Scan original
// characters once: never strip trivia before deciding where a token ends.
// Unknown or deliberately unsupported syntax is a schema refusal, not a token.
const digit = c => c !== undefined && c >= '0' && c <= '9';
const hex = c => digit(c) || (c !== undefined && ((c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')));
const letter = c => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
const id = c => letter(c) || digit(c) || c === '_' || c === '$' || (c !== undefined && c.charCodeAt(0) >= 128);
const space = c => c !== undefined && ' \t\n\f\r'.includes(c);
const refuse = () => insist(false, 'schema_mismatch:unsupported_sql', 409);
export const asciiFold = text => text.replace(/[A-Z]/g, c => c.toLowerCase());

// Only grammar-reserved keywords can be folded without parsing. SQLite's
// fallback/JOIN/window keywords can instead be identifiers or DEFAULT strings.
// Keep their original spelling, as well as every ordinary identifier.
const reserved = new Set(`add all alter and as autoincrement between case check collate commit constraint create default deferrable delete distinct drop else escape exists foreign from group having in index insert intersect into is isnull join limit not notnull null on or order primary references returning select set table then to transaction union unique update using values when where`.split(' '));
const keywords = new Set(`abort action add after all alter always analyze and as asc attach autoincrement before begin between by cascade case cast check collate column commit conflict constraint create cross current current_date current_time current_timestamp database default deferrable deferred delete desc detach distinct do drop each else end escape except exclude exclusive exists explain fail filter first following for foreign from full generated glob group groups having if ignore immediate in index indexed initially inner insert instead intersect into is isnull join key last left like limit match materialized natural no not nothing notnull null nulls of offset on or order others outer over partition plan pragma preceding primary query raise range recursive references regexp reindex release rename replace restrict returning right rollback row rows savepoint select set table temp temporary then ties to transaction trigger unbounded union unique update using vacuum values view virtual when where window with without`.split(' '));
const operators = new Set(['||','->','->>','<=','>=','<>','!=','<<','>>','==']);

function digits(sql, at, accepts) {
 let i = at;
 while (accepts(sql[i]) || sql[i] === '_') {
  if (sql[i] === '_' && (!accepts(sql[i-1]) || !accepts(sql[i+1]))) refuse();
  i++;
 }
 return i;
}
function number(sql, start) {
 let i = start, type = 'integer';
 if (sql[i] === '0' && ['x','X'].includes(sql[i+1]) && hex(sql[i+2])) {
  i = digits(sql, i+2, hex); type = 'hex';
 } else {
  i = digits(sql, i, digit);
  if (sql[i] === '.') { type = 'float'; i = digits(sql, i+1, digit); }
  if (['e','E'].includes(sql[i])) {
   type = 'float'; i++;
   if (['+','-'].includes(sql[i])) i++;
   if (!digit(sql[i])) refuse();
   i = digits(sql, i, digit);
  }
 }
 if (id(sql[i])) refuse();
 return { end: i, type };
}
function variable(sql, start) {
 let i = start+1, count = 0;
 if (sql[start] === '?') { while (digit(sql[i])) i++; return i; }
 while (i < sql.length) {
  if (id(sql[i])) { count++; i++; }
  else if (sql.startsWith('::', i)) i += 2;
  else if (sql[i] === '(' && count) {
   i++;
   while (i < sql.length && !space(sql[i]) && sql[i] !== '\v' && sql[i] !== ')') i++;
   if (sql[i] !== ')') refuse();
   i++; break;
  } else break;
 }
 if (!count) refuse();
 return i;
}
export function sqliteTokens(sql, { trivia = false } = {}) {
 if (typeof sql !== 'string' || sql.includes('\0') || !sql.isWellFormed()) refuse();
 const result = [];
 for (let i = 0; i < sql.length;) {
  const start = i, c = sql[i]; let type;
  if (space(c)) { while (space(sql[i])) i++; type = 'space'; }
  else if (c === '\v' || c === '\ufeff') refuse();
  else if (sql.startsWith('--', i)) { i = sql.indexOf('\n', i+2); if (i < 0) i = sql.length; type = 'comment'; }
  else if (sql.startsWith('/*', i)) {
   const end = sql.indexOf('*/', i+2); if (end < 0) refuse();
   i = end+2; type = 'comment';
  } else if ((c === 'x' || c === 'X') && sql[i+1] === "'") {
   i += 2; const first = i;
   while (hex(sql[i])) i++;
   if (sql[i] !== "'" || (i-first)%2) refuse();
   i++; type = 'blob';
  } else if ('\'"`['.includes(c)) {
   const close = c === '[' ? ']' : c; i++; let closed = false;
   while (i < sql.length) {
    if (sql[i++] !== close) continue;
    if (c !== '[' && sql[i] === close) { i++; continue; }
    closed = true; break;
   }
   if (!closed) refuse();
   type = c === "'" ? 'string' : 'quoted-identifier';
  } else if (digit(c) || (c === '.' && digit(sql[i+1]))) {
   const numeric = number(sql, i); i = numeric.end; type = numeric.type;
  } else if ('?@:$#'.includes(c)) { i = variable(sql, i); type = 'variable'; }
  else if (letter(c) || c === '_' || c.charCodeAt(0) >= 128) {
   while (id(sql[++i])) { /* longest identifier */ }
   type = keywords.has(asciiFold(sql.slice(start,i))) ? 'keyword' : 'identifier';
  } else {
   const three = sql.slice(i,i+3), two = sql.slice(i,i+2);
   if (operators.has(three)) i += 3;
   else if (operators.has(two)) i += 2;
   else if ('+-*/%<>=&|~();,.'.includes(c)) i++;
   else refuse();
   type = 'operator';
  }
  const text = sql.slice(start,i);
  if (trivia || (type !== 'space' && type !== 'comment')) result.push({type,text,start,end:i,
   value:type === 'keyword' && reserved.has(asciiFold(text)) ? asciiFold(text) : text});
 }
 return result;
}
const spelling = list => JSON.stringify(list.map(({type,text}) => [type,text]));
// One lexer defines the boundary rule, including comment creation, doubled
// quotes, numeric prefixes, variables and longest-match operators.
export function significantBoundary(left, right) {
 try { return spelling(sqliteTokens(left.text+right.text)) !== spelling([left,right]); }
 catch { return true; }
}
export function canonicalTokens(sql) {
 const tokens = sqliteTokens(sql), canonical = tokens.map(t => ({...t,text:t.value}));
 const joined = canonical.map((t,i) => (i && significantBoundary(canonical[i-1],t) ? ' ' : '')+t.text).join('');
 // Check the entire stream too: a lookahead spanning more than one boundary
 // must never silently collapse. Unsupported cases refuse at the public door.
 if (spelling(sqliteTokens(joined)) !== spelling(canonical)) refuse();
 return {tokens:tokens.map(({type,value}) => [type,value]),sql:joined};
}
