import { releaseIdentity } from './releases/identity.ts';
import { sanitizeSentry, type SentryEvidence } from './sentry/evidence.ts';
import { sentryGroupingInfo } from './sentry/grouping.ts';
import { parseStack, goFunction } from './stacks.ts';
import { scrub } from './scrub.ts';
import { framePath } from './frame-path.ts';
export { file } from './frame-path.ts';
export { scrub };
const idPattern = /^[a-zA-Z0-9._:-]{1,100}$/;
export function identity(v: unknown, name: string): string {
  if (typeof v !== 'string' || !(name === 'release' ? /^[a-zA-Z0-9._:@+-]{1,200}$/.test(v) : idPattern.test(v))) throw new Error(`Invalid ${name}`);
  return v;
}
function goType(value: unknown): string {
 if(typeof value!=='string'||!/^[-A-Za-z0-9_.*()[\],/:]{1,100}$/.test(value)||scrub(value)!==value)throw new Error('Invalid Go exception type');
 return value;
}
export interface Frame { file: string; line: number; column: number | null; function: string; debugId?: string }
/** `dropped`: errors at this event's location that the SDK did not send since its previous send there.
 * `client`: an optional random install identifier (never a name or address) so exposure proof can count affected users. */
export interface Envelope { version: 1; language?: 'python' | 'go'; eventId: string; release: string; build: string; environment: string; type: string; message: string; frames: Frame[]; breadcrumbs: string[]; dropped?: number; client?: string; exceptionSource?: 'parsed-text'; sentry?: SentryEvidence }
const clientPattern = /^[A-Za-z0-9_-]{16,64}$/;
export function client(value: unknown): string { if (typeof value !== 'string' || !clientPattern.test(value)) throw new Error('Invalid client'); return value; }
export function normalize(v: any): Envelope {
  if (!v || (v.language !== undefined && !['javascript','python','go'].includes(v.language))) throw new Error('Unsupported language');
  const language = v.language === 'javascript' ? undefined : v.language;
  const stack = Object.hasOwn(v, 'stack');
  if (stack) {
    const {stack: text, ...rest} = v;
    if (Object.hasOwn(v, 'frames')) v = rest; // Structured evidence wins, even over malformed text.
    else {
      if (!language) throw new Error('A textual stack requires Python or Go');
      v = {...rest, ...parseStack(language, text), exceptionSource:'parsed-text'};
    }
  }
  if (!v || v.version !== 1 || typeof v.message !== 'string' || !Array.isArray(v.frames) || (!v.frames.length && !v.sentry) || v.frames.length > 30 || !Array.isArray(v.breadcrumbs ?? [])) throw new Error('Invalid envelope');
  const allowed = new Set(['version','eventId','release','build','environment','type','message','frames','breadcrumbs','dropped','client','language','exceptionSource','sentry']);
  if (v.exceptionSource !== undefined && (!language || v.exceptionSource !== 'parsed-text')) throw new Error('Invalid exception source');
  if (Object.keys(v).some(k => !allowed.has(k))) throw new Error('Unsupported envelope field');
  if (v.dropped !== undefined && (!Number.isSafeInteger(v.dropped) || v.dropped < 1 || v.dropped > 1e9)) throw new Error('Invalid dropped count');
  if ((v.breadcrumbs ?? []).length > 20 || (v.breadcrumbs ?? []).some((b:any)=>typeof b!=='string')) throw new Error('Invalid breadcrumbs');
  return { version: 1, ...(language ? {language} : {}), eventId: identity(v.eventId,'eventId'),release:v.sentry?(v.release===''?'':releaseIdentity(v.release)):identity(v.release,'release'),build:identity(v.build,'build'),environment:identity(v.environment,'environment'),type:v.sentry ? (typeof v.type==='string'?scrub(v.type):'Error') : language==='go' ? goType(v.type) : identity(v.type,'type'),message:scrub(v.message),frames:v.frames.map((f:any)=>{
    if (!f || typeof f.file!=='string' || typeof f.function!=='string' || !Number.isSafeInteger(f.line) || f.line<1 || f.line>1e7 || (!(language && (f.column === undefined || f.column === null)) && (!Number.isSafeInteger(f.column) || f.column<0 || f.column>1e7)) || Object.keys(f).some(k=>!['file','line','column','function','debugId'].includes(k))) throw new Error('Invalid frame');
    const path=framePath(f.file,language);
    return {file:path,line:f.line,column:f.column ?? null,function:scrub(language==='go'?goFunction(f.function):f.function),...(f.debugId ? {debugId:identity(f.debugId,'debugId')} : {})};
  }),breadcrumbs:(v.breadcrumbs??[]).map(scrub),...(v.dropped !== undefined ? { dropped: v.dropped } : {}),...(v.client !== undefined ? { client: client(v.client) } : {}),...(v.exceptionSource !== undefined ? {exceptionSource:v.exceptionSource} : {}),...(v.sentry !== undefined ? {sentry:sanitizeSentry(v.sentry)} : {})};
}
export async function hash(value: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('') }
export function token(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('') }

export function canonical(value: any): string { if(value===null || typeof value!=="object") return JSON.stringify(value); if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]"; return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}" }

export function grouping(event: Envelope) {
 if(event.sentry){const info=sentryGroupingInfo(event.sentry);return {algorithm:'sentry-chain-v1',basis:info.basis};}
 const top=event.frames[0]!;
 return {algorithm:event.language ? `${event.language}-frame-v1` : 'js-frame-v1', basis:JSON.stringify([...(event.language ? [event.language] : []),event.type,top.file,top.function,top.line])};
}
