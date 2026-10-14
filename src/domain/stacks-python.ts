import type { Frame } from './privacy';

const header = 'Traceback (most recent call last):';
const chains = new Set(['During handling of the above exception, another exception occurred:', 'The above exception was the direct cause of the following exception:']);
const groupHeader = (line: string) => /^\s*\+? ?Exception Group Traceback \(most recent call last\):$/.test(line);

export function pythonStack(lines: string[]) {
 const start = lines.indexOf(header);
 if (lines.slice(0, start < 0 ? lines.length : start).some(groupHeader)) throw new Error('Python exception groups are unsupported');
 if (start < 0) throw new Error('CPython traceback required');
 if (lines.slice(0,start).some(line=>line.trim())) throw new Error('Unsupported CPython traceback preamble');
 let frames: Frame[] = [], summary: RegExpExecArray | null = null;
 for (let i = start + 1; i < lines.length; i++) {
  const line = lines[i]!;
  if (summary) {
   // After the summary, even location/header-shaped text is a note. Only a
   // CPython chain separator followed by its next header opens another stack.
   if (chains.has(line)) {
    let next = i + 1; while (next < lines.length && !lines[next]!.trim()) next++;
    if (groupHeader(lines[next] ?? '')) throw new Error('Python exception groups are unsupported');
    if (lines[next] === header) { frames = []; summary = null; i = next; }
   }
   continue;
  }
  const location = /^  File "([^"\n]+)", line ([0-9]{1,8}), in (.+)$/.exec(line);
  if (location) {
   const lineNumber = Number(location[2]);
   if (lineNumber < 1 || lineNumber > 1e7) throw new Error('Invalid Python frame location');
   frames.push({ file: location[1]!, line: lineNumber, column: null, function: location[3]! }); continue;
  }
  if (/^  File\b/.test(line)) throw new Error('Invalid Python frame location');
  if (groupHeader(line)) throw new Error('Python exception groups are unsupported');
  if (!line.trim() || /^\s/.test(line)) continue; // source text, caret and repeated-frame markers
  const exception = /^([A-Za-z_][A-Za-z0-9_.]*)(?::(?: (.*))?)?$/.exec(line);
  if (!exception) throw new Error('Unsupported CPython traceback');
  if (/(?:^|\.)(?:Base)?ExceptionGroup$/.test(exception[1]!)) throw new Error('Python exception groups are unsupported');
  summary = exception;
 }
 if (!summary || !frames.length) throw new Error('CPython exception and frames required');
 return { type: summary[1]!, message: summary[2] ?? '', frames: frames.reverse().slice(0, 30) };
}
