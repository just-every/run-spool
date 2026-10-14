import { diagnose } from '../artifacts';
import { normalize, scrub } from '../privacy';
import { DEFECT_CLASS, mapModules, moduleName, recorded, RUNNER_PROTOCOL, SANDBOX } from './sandbox';

const query = (db: D1Database, sql: string, ...args: any[]) => db.prepare(sql).bind(...args);
const INPUT_BYTES = 8192;
export const UNSUPPORTED: Record<string, string> = {
 imported_history: 'Imported history has no live capture or stored map to run against.',
 frame_not_mapped: 'The first frame does not map to original source through a stored source map.',
 source_content_missing: 'The stored map does not carry the source text of the mapped file.',
 source_language_unsupported: 'The mapped file is not a JavaScript ES module (.js or .mjs); the sandbox runs no build step.',
 source_path_unsupported: 'The mapped file path cannot be named as a sandbox module.',
 module_budget: 'The map carries more than 1 MiB of module source.',
};

// The exact call: an export of the mapped module and a JSON argument list.
// Text that the scrubber would change is refused, so what runs is what is shown.
export function callInput(body: any, fallback: string) {
 const exported = body.export === undefined ? fallback : body.export;
 if (typeof exported !== 'string' || !/^(?:default|[A-Za-z_$][\w$]{0,99})$/.test(exported)) throw new Error('Export must be an identifier or default');
 if (!Array.isArray(body.input)) throw new Error('Input must be a JSON array of arguments');
 const text = JSON.stringify(body.input);
 if (new TextEncoder().encode(text).length > INPUT_BYTES) throw new Error('Input exceeds 8 KiB');
 const strings = (value: any): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.entries(value).flatMap(([key, item]) => [key, ...strings(item)]) : [];
 if (strings(body.input).some(value => scrub(value) !== value)) throw new Error('Input contains sensitive text');
 return { export: exported, input: JSON.parse(text) };
}

// A map names the token at the throw, not its function: the default export to
// call is the nearest function declared at or above the mapped line.
function enclosingFunction(source: string, line: number) {
 const lines = source.split('\n').slice(0, line).reverse();
 for (const text of lines) {
  const match = /\bfunction\s*\*?\s*([A-Za-z_$][\w$]{0,99})\s*\(/.exec(text) ?? /\b(?:const|let|var)\s+([A-Za-z_$][\w$]{0,99})\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.exec(text);
  if (match) return match[1];
 }
 return null;
}

// Classify one stored live event against the declared defect classes and
// build the reproducer record: exact event facts, call, environment and source.
export async function classify(db: D1Database, project: string, eventId: string, body: any) {
 const row = await query(db, 'SELECT * FROM events WHERE project=? AND id=?', project, eventId).first<any>();
 if (!row) return null;
 const unsupported = (reason: string, event: any = null) => ({ issue: row.issue, support: 'unsupported' as const, reason, spec: { version: 1, defectClass: DEFECT_CLASS, event, reason: UNSUPPORTED[reason] } });
 if (row.historical === 1) return unsupported('imported_history');
 const stored = JSON.parse(row.payload);
 const envelope = normalize({ version: 1, eventId: stored.eventId, release: stored.release, build: stored.build, environment: stored.environment, type: stored.type, message: stored.message, frames: stored.frames, breadcrumbs: [] });
 const [top] = await diagnose(db, project, envelope);
 const event = { id: row.id, release: row.release, build: row.build, environment: row.environment, type: envelope.type, message: envelope.message, frame: { generated: top.generated, status: top.status, ...(top.original ? { original: top.original } : {}) } };
 if (top.status !== 'mapped') return unsupported('frame_not_mapped', event);
 if (!/\.m?js$/.test(top.original.file)) return unsupported('source_language_unsupported', event);
 const artifact = await query(db, 'SELECT payload,digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?', project, row.release, row.build, top.generated.debugId).first<any>();
 let modules;
 try { modules = await mapModules(artifact.payload); } catch (error) { if ((error as Error).message === 'module_budget') return unsupported('module_budget', event); throw error; }
 const entry = modules.find(module => module.original === top.original.file);
 if (!entry) return unsupported(moduleName(top.original.file) ? 'source_content_missing' : 'source_path_unsupported', event);
 const call = callInput(body, enclosingFunction(entry.source, top.original.line) ?? (/^[A-Za-z_$][\w$]{0,99}$/.test(top.original.function) ? top.original.function : 'default'));
 return { issue: row.issue, support: 'supported' as const, reason: null, spec: {
  version: 1, defectClass: DEFECT_CLASS, event,
  call: { module: entry.name, export: call.export, input: call.input },
  environment: SANDBOX, runner: { protocol: RUNNER_PROTOCOL },
  source: { release: row.release, build: row.build, debugId: top.generated.debugId, artifactDigest: artifact.digest, modules: recorded(modules) },
 } };
}
