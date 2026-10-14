import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The isolated sandbox: one workerd process per run, started with an empty
// process environment, holding two services. The job service runs the map's
// modules with no bindings, no disk service and an outbound network with an
// empty allow list. A separate harness service calls the job once through a
// service binding and builds the observation in its own isolate from what
// crosses that boundary; only the harness can write the result, through a disk
// service no job module can reach, so nothing the job prints, imports or
// patches can author or suppress it. A job that hangs or crashes never answers,
// which is a failure, never a reproduction. Captured input reaches the harness
// as a text module, parsed as JSON and passed as an RPC argument; generated code
// holds only checked module and export names and the run's random entry names.
export const SANDBOX = { runtime: 'workerd', compatibilityDate: '2026-09-08', compatibilityFlags: [], network: 'none', bindings: 'none', processEnvironment: 'empty', filesystem: 'none', wallClockMs: 10000 };
const modulePattern = /^[A-Za-z0-9._@+-]+(?:\/[A-Za-z0-9._@+-]+)*\.m?js$/, exportPattern = /^(?:default|[A-Za-z_$][\w$]{0,99})$/;
const require = createRequire(createRequire(import.meta.url).resolve('wrangler/package.json'));
export const workerdPath = () => require.resolve('workerd/bin/workerd');

export function validJob(job) {
 const fail = message => { throw new Error(`Refused job: ${message}`); };
 if (JSON.stringify(job?.environment) !== JSON.stringify(SANDBOX)) fail('it asks for a sandbox other than this runner provides');
 if (!Array.isArray(job.modules) || !job.modules.length || job.modules.some(m => typeof m?.name !== 'string' || !modulePattern.test(m.name) || m.name.split('/').includes('..') || m.name.startsWith('spool-') || typeof m.source !== 'string')) fail('invalid module');
 if (new Set(job.modules.map(m => m.name)).size !== job.modules.length) fail('duplicate module');
 if (!job.modules.some(m => m.name === job.call?.module) || !exportPattern.test(job.call?.export ?? '') || !Array.isArray(job.call?.input)) fail('invalid call');
 return job;
}

// The job's entry, under per-run random module and class names no job module
// can import. Its first import is a per-run module that captures the few
// primordials the call needs before any job module evaluates, so job code that
// patches iteration, then or Reflect cannot steer the call: the export is called
// with Reflect.apply and no spread, awaited only if it returned an untampered
// native promise (anything else is a returned value), and the stack is read
// without running job code. It hands back what happened as structured-cloned
// data; it never decides an outcome. Job code that the owner uploaded can still
// shape its own throw (see docs/REPRODUCE-AND-FIX.md, Trust boundary).
const primordials = `const apply = Reflect.apply, getProto = Object.getPrototypeOf, getOwn = Object.getOwnPropertyDescriptor;
const NativePromise = Promise, promiseProto = Promise.prototype, then = Promise.prototype.then;
const stackGetter = getOwn(new Error(), "stack")?.get;
export const invoke = (fn, input) => apply(fn, undefined, input);
// IsPromise without touching a proxy or fake: the original then throws first.
// A real promise counts only with its original prototype and constructor, so
// awaiting it reads data properties and runs no job code.
export function nativePromise(value) {
 if (value === null || typeof value !== "object") return false;
 try { apply(then, value, []); } catch { return false; }
 const ctor = getOwn(promiseProto, "constructor");
 return getProto(value) === promiseProto && !getOwn(value, "constructor") && !!ctor && "value" in ctor && ctor.value === NativePromise;
}
export function ownStack(error) {
 try {
  const stack = getOwn(error, "stack");
  if (!stack) return null;
  const value = "value" in stack ? stack.value : stack.get === stackGetter && stackGetter ? apply(stackGetter, error, []) : null;
  return typeof value === "string" ? value : null;
 } catch { return null; }
}
`;
const entry = (call, names) => `import { invoke, nativePromise, ownStack } from ${JSON.stringify(names.primordials)};
import { WorkerEntrypoint } from "cloudflare:workers";
import * as target from ${JSON.stringify(call.module)};
// Results carry an own then, so a then patched onto Object.prototype is never consulted.
export class ${names.entrypoint} extends WorkerEntrypoint {
 async call(input) {
  const entry = target[${JSON.stringify(call.export)}];
  if (typeof entry !== "function") return { then: undefined, missing: typeof entry };
  let value;
  try { value = invoke(entry, input); } catch (error) { return { then: undefined, threw: error, stack: ownStack(error) }; }
  if (!nativePromise(value)) return { then: undefined, returned: value };
  try { return { then: undefined, returned: await value }; } catch (error) { return { then: undefined, threw: error, stack: ownStack(error) }; }
 }
}
`;
// The harness isolate never loads job code. Values from the job are read only
// as data: no toJSON, toString or getters run, and functions stay unread.
const harness = `import input from "spool-input";
const text = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
const kind = value => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
function preview(value, depth = 0) {
 if (typeof value === "string") return JSON.stringify(value);
 if (value === null || ["number", "boolean", "undefined", "bigint", "symbol"].includes(typeof value)) return String(value);
 if (typeof value === "function") return "[function]";
 if (depth > 3) return "[object]";
 const proto = Object.getPrototypeOf(value);
 if (Array.isArray(value)) return "[" + value.slice(0, 20).map(item => preview(item, depth + 1)).join(",") + "]";
 if (proto !== Object.prototype && proto !== null) return "[" + Object.prototype.toString.call(value).slice(8, -1) + "]";
 return "{" + Object.keys(value).slice(0, 20).map(key => JSON.stringify(key) + ":" + preview(Object.getOwnPropertyDescriptor(value, key).value, depth + 1)).join(",") + "}";
}
function observe(result) {
 const own = key => Object.prototype.hasOwnProperty.call(result, key);
 if (own("missing")) return { phase: "entry_missing", type: text(result.missing, 40) };
 if (own("returned")) return { phase: "returned", type: kind(result.returned), preview: preview(result.returned).slice(0, 500) };
 const error = result.threw;
 if (!(error instanceof Error)) return { phase: "threw", name: "[thrown " + kind(error) + "]", message: "", stack: "" };
 return { phase: "threw", name: text(error.name, 200), message: text(error.message, 2000), stack: text(result.stack, 8000) };
}
export default { async test(controller, env) {
 let observation;
 try { observation = observe(await env.JOB.call(JSON.parse(input))); }
 catch (error) { observation = { phase: "sandbox_failed", detail: "The job service did not answer: " + text(error?.message, 1500) }; }
 await env.RESULT.fetch("http://result/observation.json", { method: "PUT", body: JSON.stringify(observation) });
} };
`;
const config = (modules, compatibilityDate, names, output) => `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "harness", worker = .harness),
  (name = "job", worker = .job),
  (name = "none", network = (allow = [])),
  (name = "result", disk = (path = ${JSON.stringify(output)}, writable = true)),
 ],
);
const harness :Workerd.Worker = (
 modules = [
  (name = "spool-harness.js", esModule = embed "harness.js"),
  (name = "spool-input", text = embed "input.json"),
 ],
 compatibilityDate = ${JSON.stringify(compatibilityDate)},
 bindings = [
  (name = "JOB", service = (name = "job", entrypoint = ${JSON.stringify(names.entrypoint)})),
  (name = "RESULT", service = "result"),
 ],
 globalOutbound = "none",
);
const job :Workerd.Worker = (
 modules = [
  (name = ${JSON.stringify(names.module)}, esModule = embed "entry.js"),
  (name = ${JSON.stringify(names.primordials)}, esModule = embed "primordials.js"),
${modules.map((m, index) => `  (name = ${JSON.stringify(m.name)}, esModule = embed "m${index}.js"),`).join('\n')}
 ],
 compatibilityDate = ${JSON.stringify(compatibilityDate)},
 globalOutbound = "none",
);
`;

function execute(args, cwd, limitMs) {
 return new Promise((accept, reject) => {
  const child = spawn(workerdPath(), args, { cwd, env: {}, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', killed = false;
  const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, limitMs);
  const collect = chunk => { if (output.length < 1_000_000) output += chunk; };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('close', code => { clearTimeout(timer); accept({ code, output, killed }); });
 });
}
export async function sandboxVersion() { return (await execute(['--version'], tmpdir(), 10000)).output.trim(); }

export async function runSandbox(input) {
 const job = validJob(input), directory = await mkdtemp(join(tmpdir(), 'spool-sandbox-')), output = join(directory, 'out'), random = randomBytes(16).toString('hex');
 const names = { module: `spool-entry-${random}.js`, primordials: `spool-primordials-${random}.js`, entrypoint: `Spool${random}` };
 try {
  await mkdir(output);
  await Promise.all([
   writeFile(join(directory, 'entry.js'), entry(job.call, names)),
   writeFile(join(directory, 'primordials.js'), primordials),
   writeFile(join(directory, 'harness.js'), harness),
   writeFile(join(directory, 'input.json'), JSON.stringify(job.call.input)),
   writeFile(join(directory, 'config.capnp'), config(job.modules, job.environment.compatibilityDate, names, output)),
   ...job.modules.map((m, index) => writeFile(join(directory, `m${index}.js`), m.source)),
  ]);
  const started = Date.now(), result = await execute(['test', 'config.capnp'], directory, job.environment.wallClockMs);
  if (result.killed) return { phase: 'timed_out', afterMs: Date.now() - started };
  const written = await readFile(join(output, 'observation.json'), 'utf8').catch(() => null);
  if (written !== null) return JSON.parse(written);
  const detail = result.output.split('\n').filter(line => line.trim() && !/^stack: [0-9a-f ]+$/.test(line.trim())).join('\n').split(directory).join('<sandbox>').slice(-2000);
  return { phase: /Uncaught|SyntaxError|No such module|ReferenceError|TypeError|Error/.test(detail) ? 'load_failed' : 'sandbox_failed', detail: detail || `workerd exited with code ${result.code}` };
 } finally { await rm(directory, { recursive: true, force: true }); }
}
