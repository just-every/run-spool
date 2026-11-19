import { parse } from '@babel/parser';
import { TraceMap, decodedMappings, encodedMappings, presortedDecodedMap } from '@jridgewell/trace-mapping';

/** Parse statement boundaries: comments, ASI and continued string expressions matter. */
export function bundlePosition(code) {
  // CommonJS permits top-level return/new.target; modules and Annex B scripts also parse here.
  let source;
  try { source = parse(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, allowNewTargetOutsideFunction: true }); }
  catch { throw new Error('Invalid JavaScript bundle'); }
  // The parser distinguishes real retry comments from lookalikes in strings and templates.
  const registrations = source.comments.flatMap(comment => {
    const match = /^\/\/# debugId=([0-9a-f-]+)$/i.exec(code.slice(comment.start, comment.end));
    return match ? [match[1]] : [];
  });
  return { firstStatement: source.program.body[0]?.loc.start, registrations };
}

/** Grouping uses generated lines. Insert on the first statement's line and shift only its columns. */
export function insertRegistration(code, map, { firstStatement }, registration) {
  // A directive-only or empty script can end with a shebang or a line comment.
  if (!firstStatement) return code + '\n' + registration;
  const { index: offset, line, column } = firstStatement;
  const lines = decodedMappings(new TraceMap(map)).slice();
  if (lines[line - 1]?.length) {
    const segments = lines[line - 1];
    const before = segments.filter(segment => segment[0] < column);
    const after = segments.filter(segment => segment[0] >= column);
    const previous = before.at(-1);
    if (previous?.length > 1) {
      before.push([column]); // Registration has no original source.
      if (after[0]?.[0] !== column) before.push([column + registration.length, ...previous.slice(1)]);
    }
    lines[line - 1] = before.concat(after.map(([start, ...rest]) => [start + registration.length, ...rest]));
    map.mappings = encodedMappings(presortedDecodedMap({ ...map, mappings: lines }));
  }
  return code.slice(0, offset) + registration + code.slice(offset);
}
