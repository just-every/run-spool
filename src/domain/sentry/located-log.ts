import { canonical, hash, normalize, type Envelope } from '../privacy.ts';
import { releaseIdentity } from '../releases/identity.ts';
import { sanitizeSentry } from './evidence.ts';
import { objectJson, SentryWireError } from './wire.ts';

type LogAttribute = { type: 'string' | 'boolean' | 'integer' | 'double' | 'array'; value: unknown; unit?: string };
type Privacy={document:any;jobs:D1PreparedStatement[]};
type PreparedLog = { event: Envelope; digest: string;privacy?:Privacy };
type Scrub=(document:any)=>Promise<Privacy>;
const locationKeys = ['code.file.path', 'code.function.name', 'code.line.number', 'code.column.number'];
const invalid = () => new SentryWireError('invalid_item');
const record = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, any>;
};
function boundedJson(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth >= 10) return false;
  if (Array.isArray(value)) return value.length <= 64 && value.every(item => boundedJson(item, depth + 1));
  if (value && typeof value === 'object') return Object.keys(value).length <= 64 && Object.values(value).every(item => boundedJson(item, depth + 1));
  return false;
}

function attributes(value: unknown): Record<string, unknown> {
  const rows = record(value), keys = Object.keys(rows);
  if (keys.length > 64 || keys.some(key => !key || key.length > 256)) throw invalid();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const attr = record(rows[key]) as LogAttribute;
    if (attr.unit !== undefined && (typeof attr.unit !== 'string' || attr.unit.length > 256)) throw invalid();
    const v = attr.value;
    if (attr.type === 'string' && typeof v === 'string' ||
        attr.type === 'boolean' && typeof v === 'boolean' ||
        (attr.type === 'integer' || attr.type === 'double') && typeof v === 'number' && Number.isFinite(v) && (attr.type !== 'integer' || Number.isSafeInteger(v)) ||
        attr.type === 'array' && Array.isArray(v) && boundedJson(v)) {
      result[key] = v;
    } else throw invalid();
  }
  return result;
}

function typed(values: Record<string, unknown>, key: string, type: LogAttribute['type']): any {
  const attr = values[key] as LogAttribute | undefined;
  if (!attr || attr.type !== type) throw invalid();
  return attr.value;
}

async function convert(raw: Record<string, any>,scrub?:Scrub): Promise<{event:Envelope;privacy?:Privacy}> {
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp) || raw.timestamp <= 0 ||
      typeof raw.body !== 'string' || typeof raw.level !== 'string' ||
      !['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(raw.level)) throw invalid();
  const wireAttributes = record(raw.attributes), values = attributes(wireAttributes);
  const file = typed(wireAttributes, 'code.file.path', 'string');
  const fn = typed(wireAttributes, 'code.function.name', 'string');
  const line = typed(wireAttributes, 'code.line.number', 'integer');
  const column = typed(wireAttributes, 'code.column.number', 'integer');
  if (!file.trim() || !fn.trim() || line < 1 || column < 1) throw invalid();
  const release = typed(wireAttributes, 'sentry.release', 'string');
  const build = typed(wireAttributes, 'spool.build', 'string');
  const environment = typed(wireAttributes, 'sentry.environment', 'string');
  const eventId = typed(wireAttributes, 'spool.event_id', 'string');
  const privacy=await scrub?.({message:raw.body,log:{attributes:values}}),body=privacy?.document.message??raw.body,kept=privacy?.document.log.attributes??values;
  try {
    releaseIdentity(release);
    const native = normalize({version:1,eventId,release,build,environment,type:'Log',message:body,frames:[{file,function:fn,line,column:column-1}],breadcrumbs:[]});
    const location = native.frames[0];
    const sdkName = values['sentry.sdk.name'], sdkVersion = values['sentry.sdk.version'];
    const sdk = {...(typeof sdkName === 'string' ? {name:sdkName} : {}), ...(typeof sdkVersion === 'string' ? {version:sdkVersion} : {})};
    const sentry = sanitizeSentry({version:1,exceptions:[],truncation:[],platform:'javascript',level:raw.level==='warn'?'warning':raw.level,message:body,release,environment,sdk,
      stacktrace:{frames:[{filename:location.file,function:location.function,lineno:location.line,colno:location.column!+1}]},
      extra:{log_attributes:Object.fromEntries(Object.entries(kept).filter(([key])=>!/(?:trace|span)[_.]?(?:id|context)/i.test(key)&&!/^(?:sentry\.)?user[._]/i.test(key)))}});
    return {event:normalize({...native,sentry}),privacy};
  } catch { throw invalid() }
}

/** Accept only complete SDK log containers whose records all carry an explicit location. */
export async function prepareLocatedLogs(bytes: Uint8Array,scrub?:Scrub): Promise<PreparedLog[] | null> {
  const container = objectJson(bytes);
  if (container.version !== 2 || !Array.isArray(container.items) || !container.items.length || container.items.length > 100) throw invalid();
  if (container.items.some((item: unknown) => {
    const attributes = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, any>).attributes : undefined;
    return !attributes || typeof attributes !== 'object' || Array.isArray(attributes) || !locationKeys.some(key => Object.hasOwn(attributes, key));
  })) return null;
  const result: PreparedLog[] = [];
  for (const item of container.items) {
    const raw = record(item);
    result.push({...await convert(raw,scrub),digest:await hash(canonical(raw))});
  }
  return result;
}
