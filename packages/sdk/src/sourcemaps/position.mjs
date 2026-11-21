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

/** Insert the registration without adding a line, so recorded line numbers and the issue they group under stay the same.
 * Columns after the insertion move right by its length; sparse mappings on both sides are preserved. */
export function insertRegistration(code, map, position, registration) {
  const { offset, line, character, unterminatedShebang } = position;
  const lines = decodedMappings(new TraceMap(map)).map(segments => segments.map(segment => [...segment]));
  while (lines.length <= line) lines.push([]);
  // Where the original code resumes: after the registration on the same line, or at column 0 of the line a bare shebang needs.
  const resume = unterminatedShebang ? 0 : character + registration.length;
  const before = lines[line].filter(segment => segment[0] < character);
  const after = lines[line].filter(segment => segment[0] >= character).map(segment => [segment[0] - character + resume, ...segment.slice(1)]);
  // A sparse segment remains active across the original position at the split.
  if (before.length && after[0]?.[0] !== resume) after.unshift([resume, ...before.at(-1).slice(1)]);
  before.push([character]); // Injected code must not inherit the preceding source location.
  // A shebang with no line break ends its line: the registration needs its own line there.
  if (unterminatedShebang) lines.splice(line, 1, before, [], after);
  else lines.splice(line, 1, [...before, ...after]);
  map.mappings = encodedMappings(presortedDecodedMap({ ...map, mappings: lines }));
  return code.slice(0, offset) + (unterminatedShebang ? `\n${registration}\n` : registration) + code.slice(offset);
}
