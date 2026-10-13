import { bounded, scrub } from './scrub.ts';
export { scrub };
export function file(value: string): string {
  if (/^https?:\/\//.test(value)) { try { const u = new URL(value); return scrub(`${u.origin}${u.pathname}`) } catch { return '[invalid-url]' } }
  return bounded(scrub(value.split(/[?#]/)[0]).replace(/\\/g, '/').replace(/(\/(?:Users|home)\/)[^/]+\//g,'$1[user]/'));
}
const idPattern = /^[a-zA-Z0-9._:-]{1,100}$/;
export function identity(v: unknown, name: string): string {
  if (typeof v !== 'string' || !(name === 'release' ? /^[a-zA-Z0-9._:@+-]{1,200}$/ : idPattern).test(v)) throw new Error(`Invalid ${name}`);
  return v;
}
export interface Frame { file: string; line: number; column: number; function: string; debugId?: string }
/** `dropped`: errors at this event's location that the SDK did not send since its previous send there. */
export interface Envelope { version: 1; eventId: string; release: string; build: string; environment: string; type: string; message: string; frames: Frame[]; breadcrumbs: string[]; dropped?: number }
export function normalize(v: any): Envelope {
  if (!v || v.version !== 1 || typeof v.message !== 'string' || !Array.isArray(v.frames) || !v.frames.length || v.frames.length > 30 || !Array.isArray(v.breadcrumbs ?? [])) throw new Error('Invalid envelope');
  const allowed = new Set(['version','eventId','release','build','environment','type','message','frames','breadcrumbs','dropped']);
  if (Object.keys(v).some(k => !allowed.has(k))) throw new Error('Unsupported envelope field');
  if (v.dropped !== undefined && (!Number.isSafeInteger(v.dropped) || v.dropped < 1 || v.dropped > 1e9)) throw new Error('Invalid dropped count');
  if ((v.breadcrumbs ?? []).length > 20 || (v.breadcrumbs ?? []).some((b:any)=>typeof b!=='string')) throw new Error('Invalid breadcrumbs');
  return { version: 1, eventId: identity(v.eventId,'eventId'),release:identity(v.release,'release'),build:identity(v.build,'build'),environment:identity(v.environment,'environment'),type: identity(v.type,'type'),message:scrub(v.message),frames:v.frames.map((f:any)=>{
    if (!f || typeof f.file!=='string' || typeof f.function!=='string' || !Number.isSafeInteger(f.line) || f.line<1 || f.line>1e7 || !Number.isSafeInteger(f.column) || f.column<0 || f.column>1e7 || Object.keys(f).some(k=>!['file','line','column','function','debugId'].includes(k))) throw new Error('Invalid frame');
    return {file:file(f.file),line:f.line,column:f.column,function:scrub(f.function),...(f.debugId ? {debugId:identity(f.debugId,'debugId')} : {})};
  }),breadcrumbs:(v.breadcrumbs??[]).map(scrub),...(v.dropped !== undefined ? { dropped: v.dropped } : {})};
}
export async function hash(value: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('') }
export function token(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('') }

export function canonical(value: any): string { if(value===null || typeof value!=="object") return JSON.stringify(value); if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]"; return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}" }
