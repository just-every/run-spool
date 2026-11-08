import { sha256 } from './hash.mjs';
import { splitStatements } from './sql-text.mjs';
import { insist, PortabilityError } from './storage.mjs';
import { migrationReplay } from './migration-history.mjs';
import { checkoutHistory } from './checkout-history.mjs';

// Node library callers have the same checkout evidence as the runner. Resolve
// only its single declared D1 migration directory, never an archive-supplied path.
// Variable imports keep Node builtins out of a Worker's module graph.
const nodeModule = name => import(name);
export async function libraryMigrations(db,config,root) {
  try{return await checkoutMigrations(db,config,root);}
  catch(error){if(error instanceof PortabilityError)throw error;throw new PortabilityError('schema_mismatch:legacy_evidence',409);}
}
async function checkoutMigrations(db,config,root) {
  insist(typeof process!=='undefined' && process.versions?.node,'schema_mismatch:legacy_evidence',409);
  const [{readFile,readdir},{resolve,sep}]=await Promise.all([nodeModule('node:fs/promises'),nodeModule('node:path')]);
  root=resolve(root??process.cwd());
  const declaration=parseJsonc(await readFile(resolve(root,'wrangler.jsonc'),'utf8'));
  insist(declaration.d1_databases?.length===1,'schema_mismatch:legacy_evidence',409);
  const directory=resolve(root,declaration.d1_databases[0].migrations_dir??'migrations');
  insist(directory===root || directory.startsWith(root+sep),'schema_mismatch:legacy_evidence',409);
  const files=await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.sql')).sort().map(async name=>{
    const bytes=await readFile(resolve(directory,name));
    return {name,sha256:await sha256(bytes),statements:splitStatements(bytes.toString('utf8'))};
  }));
  const replay=await checkoutHistory(db,config,files,applied=>migrationReplay(applied.map(name=>files.find(file=>file.name===name)),config));
  return async()=>replay;
}

// This copied runtime cannot depend on the authoring CLI. Keep the strict
// JSONC reader local so checkout configuration has the same syntax rules.
function location(text, position) {
 const lines = text.slice(0, position).split('\n');
 return `position ${position} (line ${lines.length} column ${lines.at(-1).length + 1})`;
}

// Validate JSONC before JSON.parse so diagnostics do not depend on the Node
// version's error wording. An explicit stack also handles deeply nested input.
// Only comments and commas accepted by the grammar are masked; offsets stay in
// the original source and comment removal can never join separate tokens.
function parseJsonc(text, onProperty) {
 const result = text.split(''), stack = [{ kind: 'root', state: 'value', path: [] }];
 let index = 0;
 const fail = (message, position = index) => {
  throw new SyntaxError(`${position === text.length ? 'Unexpected end of JSON input' : message} at ${location(text, position)}`);
 };
 const unterminated = (kind, start) => {
  throw new SyntaxError(`Unterminated ${kind} at ${location(text, start)}; close the ${kind}.`);
 };
 const blank = start => {
  for (let i = start; i < index; i++) if (text[i] !== '\n' && text[i] !== '\r') result[i] = ' ';
 };
 const space = () => {
  while (index < text.length) {
   if (' \t\r\n'.includes(text[index])) { index++; continue; }
   const start = index;
   if (text[index] === '/' && text[index + 1] === '/') {
    index += 2;
    while (index < text.length && text[index] !== '\n' && text[index] !== '\r') index++;
   } else if (text[index] === '/' && text[index + 1] === '*') {
    const end = text.indexOf('*/', index + 2);
    if (end === -1) unterminated('block comment', start);
    index = end + 2;
   } else break;
   blank(start);
  }
 };
 const string = () => {
  const start = index++;
  let end = index;
  while (end < text.length && text[end] !== '"') end = Math.min(text.length, end + (text[end] === '\\' ? 2 : 1));
  if (end === text.length) unterminated('string', start);
  while (index < end) {
   if (text.charCodeAt(index) < 32) fail('Unescaped control character in string');
   if (text[index++] !== '\\') continue;
   if (text[index] === 'u') {
    index++;
    for (let digit = 0; digit < 4; digit++, index++) {
     if (index >= end || !/[0-9a-fA-F]/.test(text[index])) fail('Invalid Unicode escape');
    }
   } else {
    if (!'"\\/bfnrt'.includes(text[index])) fail('Invalid string escape');
    index++;
   }
  }
  index++;
 };
 const digit = () => index < text.length && text[index] >= '0' && text[index] <= '9';
 const digits = () => {
  if (!digit()) fail('Expected a digit');
  do { index++; } while (digit());
 };
 const number = () => {
  if (text[index] === '-') index++;
  if (text[index] === '0') index++;
  else digits();
  if (text[index] === '.') { index++; digits(); }
  if (text[index] === 'e' || text[index] === 'E') {
   index++;
   if (text[index] === '+' || text[index] === '-') index++;
   digits();
  }
 };
 while (stack.length) {
  space();
  const frame = stack.at(-1), char = text[index], closing = frame.kind === 'object' ? '}' : ']';
  if (frame.state === 'end') {
   if (index < text.length) fail('Unexpected token after JSON value');
   stack.pop();
  } else if ((frame.state === 'keyOrEnd' || frame.state === 'valueOrEnd' || frame.state === 'comma') && char === closing) {
   index++; stack.pop();
  } else if (frame.state === 'keyOrEnd') {
   if (char !== '"') fail('Expected a property name');
   const start = index; string();
   frame.key = onProperty ? JSON.parse(text.slice(start, index)) : undefined;
   onProperty?.([...frame.path, frame.key], start);
   frame.state = 'colon';
  } else if (frame.state === 'colon') {
   if (char !== ':') fail("Expected ':' after property name");
   index++; frame.state = 'value';
  } else if (frame.state === 'comma') {
   if (char !== ',') fail(`Expected ',' or '${closing}'`);
   const comma = index++;
   space();
   if (text[index] === closing) result[comma] = ' ';
   frame.state = frame.kind === 'object' ? 'keyOrEnd' : 'valueOrEnd';
  } else {
   const path = !onProperty ? undefined : frame.kind === 'root' ? [] : [...frame.path, frame.kind === 'array' ? frame.next++ : frame.key];
   frame.state = frame.kind === 'root' ? 'end' : 'comma';
   if (char === '{' || char === '[') {
    index++;
    stack.push({ kind: char === '{' ? 'object' : 'array', state: char === '{' ? 'keyOrEnd' : 'valueOrEnd', path, next: 0 });
   } else if (char === '"') string();
   else if (char === '-' || digit()) number();
   else {
    const literal = { t: 'true', f: 'false', n: 'null' }[char];
    if (!literal) fail('Unexpected token in JSON value');
    for (const expected of literal) {
     if (text[index] !== expected) fail(`Expected '${literal}'`);
     index++;
    }
   }
  }
 }
 return JSON.parse(result.join(''));
}
