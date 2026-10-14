import type { Frame } from './privacy';

function symbol(value: string) {
 if (!value || /[\x00-\x1f\x7f]/.test(value) || value.endsWith('.')) return false;
 let brackets = 0;
 for (let i = 0; i < value.length; i++) {
  const char = value[i]!;
  if (char === '[') brackets++;
  else if (char === ']') { if (--brackets < 0) return false; }
  else if (!brackets) {
   if (/\s/.test(char) || char === ')') return false;
   if (char === '(') {
    let close = i + 1, genericDepth = 0;
    for (; close < value.length; close++) {
     if (value[close] === '[') genericDepth++;
     else if (value[close] === ']') genericDepth--;
     else if (value[close] === ')' && genericDepth === 0) break;
    }
    const receiver = value.slice(i + 1, close);
    if (value[i - 1] !== '.' || value[close + 1] !== '.' || !/^\*?[\p{L}_][\p{L}\p{Nd}_.]*(?:\[[^\r\n]*\])?$/u.test(receiver)) return false;
    // Visit generic arguments too, so their brackets must balance.
    if (!symbol(receiver)) return false;
    i = close;
   }
  }
 }
 return brackets === 0;
}

function functionName(line: string) {
 // Work backwards from the final call. Receiver parentheses and generic type
 // arguments belong to the symbol, including Unicode Go identifiers.
 const value = line.trimEnd();
 if (!value.endsWith(')')) return null;
 let depth = 0;
 for (let i = value.length - 1; i >= 0; i--) {
  if (value[i] === ')') depth++;
  else if (value[i] === '(' && --depth === 0) {
   const name = value.slice(0, i);
   return symbol(name) ? name : null;
  }
 }
 return null;
}

function location(line: string) {
 const match = /^\s+(.+):([0-9]{1,8})(?:\s+\+0x[0-9a-f]+)?(?:\s+fp=0x[0-9a-f]+\s+sp=0x[0-9a-f]+\s+pc=0x[0-9a-f]+)?\s*$/.exec(line);
 if (!match || Number(match[2]) < 1 || Number(match[2]) > 1e7) throw new Error('Invalid Go frame location');
 return { file: match[1]!, line: Number(match[2]), column: null };
}

function preamble(lines: string[], end: number, prefixIndex: number) {
 let runtime = false;
 for (let i = 0; i < end; i++) {
  const line = lines[i]!;
  if (!line.trim()) continue;
  const next = lines.slice(i + 1,end).find(value=>value.trim()) ?? '';
  if (line === 'Traceback (most recent call last):' && /^  File "/.test(next) || /^\s*\+? ?Exception Group Traceback \(most recent call last\):$/.test(line) && /^\s*\|\s+File "/.test(next)) throw new Error('Foreign traceback in Go stack');
  if (i === prefixIndex) continue;
  if (i < prefixIndex || prefixIndex < 0) {
   if (prefixIndex >= 0) continue; // runtime diagnostics before panic/fatal error
   throw new Error('Unsupported Go stack preamble');
  }
  if (/^\s+panic:/.test(line) || /^\[signal [^\r\n]+\]$/.test(line)) continue;
  if (line === 'runtime stack:') { runtime = true; continue; }
  if (runtime && functionName(line)) { location(lines[++i] ?? ''); continue; }
  if (runtime && line === '...additional frames elided...') continue;
  if (runtime) throw new Error('Unsupported Go runtime stack');
  // Panic values may contain newlines. Their continuation text is not a frame.
 }
}

export function goStack(lines: string[]) {
 const headers = lines.flatMap((line, index) => {
  const match = /^goroutine \d+ \[([^\]\r\n]+)\]:$/.exec(line);
  return match ? [{index, state:match[1]!.split(',')[0]}] : [];
 });
 const running = headers.filter(h => h.state === 'running'), runnable = headers.filter(h => h.state === 'runnable');
 const candidates = running.length ? running : runnable;
 const chosen = candidates.length === 1 ? candidates[0] : !candidates.length && headers.length === 1 ? headers[0] : undefined;
 if (headers.length && !chosen) throw new Error('Current Go goroutine is ambiguous or unavailable');
 const prefixIndex = lines.findIndex((line,index) => index < (headers[0]?.index ?? lines.length) && /^(?:panic:|fatal error:)/.test(line)), prefix = lines[prefixIndex];
 if (!prefix && !chosen) throw new Error('Go panic or goroutine stack required');
 preamble(lines,headers[0]?.index ?? prefixIndex + 1,prefixIndex);
 const start = chosen ? chosen.index + 1 : prefixIndex + 1, end = headers.find(h => h.index > start)?.index ?? lines.length;
 const frames: Frame[] = []; let ancestry = false;
 for (let i = start; i < end; i++) {
  const line = lines[i]!;
  if (!line.trim()) continue;
  if (ancestry) throw new Error('Unsupported Go stack suffix');
  if (!chosen && !frames.length && (/^\s*(?:panic:|fatal error:)/.test(line) || /^\[signal [^\r\n]+\]$/.test(line) || line === 'runtime stack:')) continue;
  if (line === '...additional frames elided...') continue;
  if (line.startsWith('created by ')) {
   const creator = line.slice('created by '.length).replace(/ in goroutine \d+$/, '');
   if (!symbol(creator) || !frames.length) throw new Error('Invalid Go ancestry');
   location(lines[++i] ?? ''); ancestry = true; continue;
  }
  const name = functionName(line);
  if (!name) throw new Error('Go function/location pairs required');
  frames.push({...location(lines[++i] ?? ''), function:name});
 }
 if (!frames.length) throw new Error('Go function/location pairs required');
 return { type: prefix?.startsWith('fatal error:') ? 'RuntimeError' : 'panic', message: prefix?.replace(/^(?:panic:|fatal error:)\s*/, '') ?? '', frames: frames.slice(0, 30) };
}

export function goFunction(value: string) {
 if (!value.includes('(')) return value;
 const parsed = functionName(value);
 if (parsed) return parsed;
 if (symbol(value)) return value; // a structured receiver without runtime arguments
 throw new Error('Invalid Go function symbol');
}
