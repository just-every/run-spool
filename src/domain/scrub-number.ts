// Card-number-like digit runs (13-19 digits, spaces or hyphens between) become
// [number]. A hyphenated identifier is read whole first, so a UUID or trace
// context whose adjacent groups happen to be all digits is never cut into one.
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const traceparent='[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}';
const digitRun=String.raw`\b(?:\d[ -]*?){13,19}\b`;
const numberOrIdentifier=new RegExp(String.raw`(?<![A-Za-z0-9])(${uuid}|${traceparent})(?![A-Za-z0-9])|${digitRun}`,'gi');
export const scrubNumbers=(text:string)=>text.replace(numberOrIdentifier,(match,identifier?:string)=>identifier?match:'[number]');
