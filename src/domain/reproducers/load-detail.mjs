import { scrub } from '../scrub.ts';

export const unavailableMap = 'The stored map for this run changed or became unavailable after it was queued.';
const unknownModule = '[hidden-module]';

// workerd can resolve an import to a local path or URL. Keep just the file
// name (or scoped package name), never the machine, directories or query.
function moduleLabel(specifier) {
 const path = specifier.split(/[?#]/, 1)[0].replaceAll('\\', '/');
 const name = path.match(/(?:^|\/)(@[a-z0-9-]+\/[a-z0-9._-]+)$/i)?.[1] ?? path.split('/').at(-1);
 if (/(?:^|\/)(?:[a-z][a-z0-9+.-]*:|Users\/|home\/|private\/|tmp\/)/i.test(path) && !/\.[cm]?js$/i.test(name)) return unknownModule;
 if (!name || name.length > 100 || !/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) ||
     /[a-z0-9]{32,}/i.test(name) || scrub(name) !== name) return unknownModule;
 return name;
}

// Accept both workerd diagnostics (including older runner reports) and this
// bounded description. Free-form messages, source excerpts and stacks stay out.
export function moduleLoadDetail(detail) {
 if (typeof detail !== 'string') detail = '';
 const start = Math.max(0, detail.indexOf('service job: Uncaught '));
 detail = detail.slice(start, start + 4000);
 if (detail === unavailableMap) return unavailableMap;
 const missing = /\b(No such module|Invalid module specifier) "([^"\r\n]+)"\.(?:\s+[Ii]mported from "([^"\r\n]+)")?/.exec(detail);
 if (missing) {
  const from = missing[3] ? ` Imported from "${moduleLabel(missing[3])}".` : '';
  return `${missing[1]} "${moduleLabel(missing[2])}".${from}`;
 }
 const error = /^(?:service job: Uncaught )?(SyntaxError|TypeError|ReferenceError|RangeError|Error)\b/m.exec(detail);
 if (error) {
  const location = /\bat (?:[^\r\n()]* \()?([^\s:()]+):(\d{1,7}):(\d{1,7})\b/.exec(detail);
  if (location) return `${error[1]} at ${moduleLabel(location[1])}:${location[2]}:${location[3]}.`;
  return `${error[1]} while loading the uploaded modules.`;
 }
 return 'The sandbox could not load the uploaded modules.';
}
