import { scrub } from '../scrub';

export const nativeSymbolByteLimit = 1024 * 1024;
const javaName = '[A-Za-z_$][A-Za-z0-9_$]*(?:\\.[A-Za-z_$][A-Za-z0-9_$]*)*';
const classLine = new RegExp(`^(${javaName}) -> (${javaName}):$`);
const methodLine = new RegExp(`^(?:(\\d+):(\\d+):)?([^\\s]+) (${javaName}|<init>|<clinit>)\\(([^()]*)\\)(?::(\\d+)(?::(\\d+))?)? -> ([A-Za-z_$][A-Za-z0-9_$]*)$`);
const fieldLine = new RegExp(`^[^\\s]+ ${javaName} -> [A-Za-z_$][A-Za-z0-9_$]*$`);
type Method = { name: string; obfuscated: string; start: number | null; end: number | null; originalStart: number | null; originalEnd: number | null };
type ClassMapping = { name: string; file: string | null; methods: Method[] };
export type ProguardMapping = Map<string, ClassMapping>;
const coordinate = (value: string | undefined): number | null => {
 if (value === undefined) return null;
 const n = Number(value);
 if (!Number.isSafeInteger(n) || n < 0 || n > 1e7) throw new Error('Invalid native symbol line');
 return n;
};

/** Parse the bounded ProGuard/R8 text grammar. Metadata never supplies execution authority. */
export function parseProguard(payload: string): ProguardMapping {
 if (typeof payload !== 'string' || !payload.trim() || new TextEncoder().encode(payload).length > nativeSymbolByteLimit) throw new Error('Native symbols exceed 1 MiB or are empty');
 if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(payload)) throw new Error('Invalid native symbol text');
 const lines = payload.split(/\r?\n/);
 if (lines.length > 30000) throw new Error('Native symbol parser budget');
 const classes: ProguardMapping = new Map();
 let current: ClassMapping | undefined, members = 0;
 for (const raw of lines) {
  if (raw.length > 4096) throw new Error('Native symbol line exceeds limit');
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith('#')) {
   const body = line.slice(1).trim();
   if (body.startsWith('{')) {
    let metadata: any;
    try { metadata = JSON.parse(body); } catch { throw new Error('Malformed native symbol metadata'); }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid native symbol metadata');
    if (metadata.id === 'sourceFile') {
     if (!current || typeof metadata.fileName !== 'string' || !/^[A-Za-z0-9_$.-]{1,200}\.(?:java|kt|scala)$/.test(metadata.fileName) || scrub(metadata.fileName) !== metadata.fileName || current.file && current.file !== metadata.fileName) throw new Error('Invalid native source file identity');
     current.file = metadata.fileName;
    }
   }
   continue;
  }
  const klass = classLine.exec(line);
  if (klass && !/^\s/.test(raw)) {
   if (classes.size >= 5000 || classes.has(klass[2]!) || scrub(klass[1]!) !== klass[1]) throw new Error('Duplicate or invalid native class identity');
   current = { name: klass[1]!, file: null, methods: [] };
   classes.set(klass[2]!, current);
   continue;
  }
  if (!current || !/^\s/.test(raw) || ++members > 20000) throw new Error('Invalid native member or parser budget');
  const method = methodLine.exec(line);
  if (!method) {
   if (fieldLine.test(line)) continue;
   throw new Error('Unsupported native symbol member');
  }
  const start = coordinate(method[1]), end = coordinate(method[2]), originalStart = coordinate(method[6]), originalEnd = coordinate(method[7]) ?? originalStart;
  if (start !== null && end! < start || originalStart !== null && originalEnd! < originalStart) throw new Error('Invalid native symbol range');
  current.methods.push({ name: method[4]!, obfuscated: method[8]!, start, end, originalStart, originalEnd });
 }
 if (!classes.size || ![...classes.values()].some(c => c.methods.length)) throw new Error('Native mapping contains no methods');
 return classes;
}

export function retrace(mapping: ProguardMapping, name: string, line: number) {
 const split = name.lastIndexOf('.');
 const klass = mapping.get(name.slice(0, split));
 if (!klass || split < 1) return { status: 'native_symbol_unmapped' };
 const method = name.slice(split + 1);
 const candidates = klass.methods.filter(m => m.obfuscated === method && (m.start === null || line >= m.start && line <= m.end!));
 if (!candidates.length) return { status: 'native_symbol_unmapped' };
 const originals = candidates.map(m => {
  // ProGuard may omit original ranges or describe inlining. Such ranges cannot
  // establish one original source coordinate and remain explicit gaps.
  if (m.start === null || m.originalStart === null || m.originalStart < 1) return null;
  const originalLine = m.originalEnd === m.originalStart ? m.originalStart : m.originalEnd! - m.originalStart === m.end! - m.start ? m.originalStart + line - m.start : null;
  return originalLine === null ? null : { file: klass.file, line: originalLine, column: null, function: m.name.includes('.') ? m.name : `${klass.name}.${m.name}` };
 });
 if (originals.some(o => !o) || new Set(originals.map(o => JSON.stringify(o))).size !== 1) return { status: 'native_symbol_ambiguous' };
 if (!klass.file) return { status: 'native_symbol_source_unavailable' };
 return { status: 'mapped', original: originals[0]! };
}
