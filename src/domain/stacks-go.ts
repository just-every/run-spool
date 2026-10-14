import type { Frame } from './privacy';
import { scrub } from './scrub.ts';
import { framePath } from './frame-path.ts';

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
 // Check the same normalized path used at admission before a block can count
 // as usable or outrank another. Keep the raw path for admission to scrub once.
 framePath(match[1]!, 'go');
 return { file: match[1]!, line: Number(match[2]), column: null };
}

function preamble(lines: string[], end: number, prefixIndex: number) {
 for (let i = 0; i < end; i++) {
  const line = lines[i]!;
  if (!line.trim()) continue;
  if (i < prefixIndex && (line === 'Traceback (most recent call last):' || /^\s*\+? ?Exception Group Traceback \(most recent call last\):$/.test(line))) {
   let next = i + 1; while (next < end && !lines[next]!.trim()) next++;
   if (/^  File "/.test(lines[next] ?? '') || /^\s*\|\s+File "/.test(lines[next] ?? '')) throw new Error('Foreign traceback in Go stack');
  }
  if (prefixIndex < 0) throw new Error('Unsupported Go stack preamble');
  // Runtime diagnostics before the prefix and multiline panic values after it
  // are text, even when they imitate runtime-stack metadata.
 }
}

function goroutineFrames(lines: string[], start: number, end: number) {
 const frames: Frame[] = []; let ancestry = false, count = 0;
 for (let i = start; i < end; i++) {
  const line = lines[i]!;
  if (!line.trim()) continue;
  if (ancestry) throw new Error('Unsupported Go stack suffix');
  if (!count && (/^\s*(?:panic:|fatal error:)/.test(line) || /^\[signal [^\r\n]+\]$/.test(line) || line === 'runtime stack:')) continue;
  if (line === '...additional frames elided...') continue;
  if (line.startsWith('created by ')) {
   const creator = line.slice('created by '.length).replace(/ in goroutine \d+$/, '');
   if (!symbol(creator) || !count) throw new Error('Invalid Go ancestry');
   location(lines[++i] ?? ''); ancestry = true; continue;
  }
  const name = functionName(line);
  if (!name) throw new Error('Go function/location pairs required');
  const position = location(lines[++i] ?? '');
  if (frames.length < 30) frames.push({...position, function:name});
  count++;
 }
 if (!count) throw new Error('Go function/location pairs required');
 return frames;
}

function panicMessage(lines: string[], prefixIndex: number, selectedStart: number, selectedEnd: number) {
 let message = prefixIndex < 0 ? '' : lines[prefixIndex]!.replace(/^(?:panic:|fatal error:)\s*/, '');
 for (let i = Math.max(0,prefixIndex + 1); i < lines.length && message.length < 1000; i++) {
  if (i >= selectedStart && i < selectedEnd) continue;
  const line = lines[i]!;
  // Retain ignored headers and message continuation, never raw call arguments,
  // source locations, offsets, ancestry or traceback source lines.
  // Privacy recognition is deliberately looser than frame validation: an
  // invalid or truncated block can still contain arguments and runtime data.
  const call = /^[^\s(]+\(/.test(line) || /^[^\s[(]+\[[^\r\n]*\(/.test(line);
  // Paths may contain spaces, even without a directory component. Recognize
  // their coordinate, separator or source suffix rather than a non-space
  // token. Path-shaped lines also cover malformed or truncated coordinates.
  const source = /^(?:[^\r\n]+:[+-]?\d|[^\r\n]*[\\/][^\r\n]*:|[^\r\n]+\.(?:go|s|c|h):)/i.test(line);
  const runtime = /^(?:\[signal\b|signal\s+SIG[A-Z0-9]+\b|runtime stack:|(?:fp|sp|pc|lr|addr|code)\s*[=:]|0x[\da-f]+\b|[a-z][a-z0-9]*\s+0x[\da-f]+\b)/i.test(line);
  if (functionName(line) || call || source || runtime || /^\s/.test(line) || line.startsWith('created by ') || line === '...additional frames elided...') continue;
  message += '\n' + line;
 }
 return scrub(message);
}

export function goStack(lines: string[]) {
 const headers = lines.flatMap((line, index) => {
  const match = /^goroutine \d+ \[([^\]\r\n]+)\]:$/.exec(line);
  return match ? [{index, state:match[1]!.split(',')[0]}] : [];
 });
 const prefixIndex = lines.findIndex((line,index) => index < (headers[0]?.index ?? lines.length) && /^(?:panic:|fatal error:)/.test(line)), prefix = lines[prefixIndex];
 if (!prefix && !headers.length) throw new Error('Go panic or goroutine stack required');
 preamble(lines,headers[0]?.index ?? prefixIndex + 1,prefixIndex);
 let frames: Frame[] | undefined, selectedStart = -1, selectedEnd = -1;
 if (!headers.length) frames = goroutineFrames(lines,prefixIndex + 1,lines.length);
 else {
  // Text cannot authenticate a goroutine header. Prefer the last usable block
  // at the highest priority; fake or excessive headers must not veto evidence.
  // Blocks are disjoint, so total scanning stays within the input line budget.
  let priority = -1, usable = 0;
  // Walk backwards so panic text before the real current stack cannot consume
  // the 30 usable-goroutine budget. Invalid blocks only consume the line budget.
  for (let index = headers.length - 1; index >= 0 && usable < 30; index--) {
   const header = headers[index]!;
   const rank = header.state === 'running' ? 2 : header.state === 'runnable' ? 1 : 0;
   try {
    const candidate = goroutineFrames(lines,header.index + 1,headers[index + 1]?.index ?? lines.length);
    usable++;
    if (rank > priority) { priority = rank; frames = candidate; selectedStart = header.index + 1; selectedEnd = headers[index + 1]?.index ?? lines.length; }
   } catch { /* A header-shaped panic value need not contain a valid stack. */ }
  }
 }
 if (!frames) throw new Error('Go function/location pairs required');
 return { type: prefix?.startsWith('fatal error:') ? 'RuntimeError' : 'panic', message: headers.length ? panicMessage(lines,prefixIndex,selectedStart,selectedEnd) : prefix?.replace(/^(?:panic:|fatal error:)\s*/, '') ?? '', frames };
}

export function goFunction(value: string) {
 if (!value.includes('(')) return value;
 const parsed = functionName(value);
 if (parsed) return parsed;
 if (symbol(value)) return value; // a structured receiver without runtime arguments
 throw new Error('Invalid Go function symbol');
}
