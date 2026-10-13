import { parse } from '@babel/parser';
import { TraceMap, decodedMappings, encodedMappings, presortedDecodedMap } from '@jridgewell/trace-mapping';

/** Parse statement boundaries: comments, ASI and continued string expressions matter. */
export function bundlePosition(code) {
  // CommonJS permits top-level return/new.target; modules and Annex B scripts also parse here.
  let source;
  try { source = parse(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, allowNewTargetOutsideFunction: true }); }
  catch { throw new Error('Invalid JavaScript bundle'); }
  const shebangEnd = source.program.interpreter?.end;
  const shebangBreak = shebangEnd === undefined ? '' : /^(?:\r\n|[\n\r\u2028\u2029])/.exec(code.slice(shebangEnd))?.[0] ?? '';
  const offset = source.program.directives.at(-1)?.end ?? (shebangEnd === undefined ? 0 : shebangEnd + shebangBreak.length);
  const prefixLines = code.slice(0, offset).split(/\r\n|[\n\r\u2028\u2029]/);
  // The parser distinguishes real retry comments from lookalikes in strings and templates.
  const registrations = source.comments.flatMap(comment => {
    const match = /^\/\/# debugId=([0-9a-f-]+)$/i.exec(code.slice(comment.start, comment.end));
    return match ? [match[1]] : [];
  });
  return { offset, line: prefixLines.length - 1, character: prefixLines.at(-1).length, registrations,
    unterminatedShebang: shebangEnd !== undefined && !shebangBreak };
}

/** Split the affected generated line, preserving sparse mappings on both sides. */
export function insertRegistration(code, map, position, registration) {
  const { offset, line, character, unterminatedShebang } = position;
  const inserted = `${unterminatedShebang ? '\n' : ''}${registration}\n`;
  const lines = decodedMappings(new TraceMap(map)).map(segments => segments.map(segment => [...segment]));
  while (lines.length <= line) lines.push([]);
  const before = lines[line].filter(segment => segment[0] < character);
  const after = lines[line].filter(segment => segment[0] >= character).map(segment => [segment[0] - character, ...segment.slice(1)]);
  // A sparse segment remains active across the original position at the split.
  if (before.length && after[0]?.[0] !== 0) after.unshift([0, ...before.at(-1).slice(1)]);
  before.push([character]); // Injected code must not inherit the preceding source location.
  lines.splice(line, 1, before, ...(unterminatedShebang ? [[]] : []), after);
  map.mappings = encodedMappings(presortedDecodedMap({ ...map, mappings: lines }));
  return code.slice(0, offset) + inserted + code.slice(offset);
}
