import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The isolated sandbox: a separate workerd process per run, started with an
// empty process environment, whose only outbound service is a network with an
// empty allow list, with no bindings, no disk service and a wall-clock kill.
// Captured input reaches it as a text module and is parsed as JSON, never
// spliced into code. Only module names, the export name and the run's random
// marker appear in generated code, each checked against a strict pattern first.
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

function harness(call, marker) {
 return `import * as target from ${JSON.stringify(call.module)};
import input from "spool-input";
const report = console.log.bind(console);
const preview = value => { try { return String(JSON.stringify(value) ?? String(value)).slice(0, 500); } catch { return String(value).slice(0, 500); } };
export default { async test() {
 let observation;
 const entry = target[${JSON.stringify(call.export)}];
 if (typeof entry !== "function") observation = { phase: "entry_missing", type: typeof entry };
 else try {
  const value = await entry(...JSON.parse(input));
  observation = { phase: "returned", type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value, preview: preview(value) };
 } catch (error) {
  observation = { phase: "threw", name: String(error?.name ?? typeof error).slice(0, 200), message: String(error?.message ?? error).slice(0, 2000), stack: String(error?.stack ?? "").slice(0, 8000) };
 }
 report(${JSON.stringify(marker)} + " " + JSON.stringify(observation));
} };
`;
}
const config = (modules, compatibilityDate) => `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "main", worker = .sandbox),
  (name = "none", network = (allow = [])),
 ],
);
const sandbox :Workerd.Worker = (
 modules = [
  (name = "spool-harness.js", esModule = embed "harness.js"),
${modules.map((m, index) => `  (name = ${JSON.stringify(m.name)}, esModule = embed "m${index}.js"),`).join('\n')}
  (name = "spool-input", text = embed "input.json"),
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
 const job = validJob(input), directory = await mkdtemp(join(tmpdir(), 'spool-sandbox-')), marker = 'SPOOL_OBSERVATION_' + randomBytes(16).toString('hex');
 try {
  await Promise.all([
   writeFile(join(directory, 'harness.js'), harness(job.call, marker)),
   writeFile(join(directory, 'input.json'), JSON.stringify(job.call.input)),
   writeFile(join(directory, 'config.capnp'), config(job.modules, job.environment.compatibilityDate)),
   ...job.modules.map((m, index) => writeFile(join(directory, `m${index}.js`), m.source)),
  ]);
  const started = Date.now(), result = await execute(['test', 'config.capnp'], directory, job.environment.wallClockMs);
  if (result.killed) return { phase: 'timed_out', afterMs: Date.now() - started };
  const lines = result.output.split('\n').filter(line => line.startsWith(marker + ' '));
  if (lines.length > 1) return { phase: 'sandbox_failed', detail: 'The sandbox printed more than one observation.' };
  if (lines.length === 1) return JSON.parse(lines[0].slice(marker.length + 1));
  const detail = result.output.split('\n').filter(line => line.trim() && !/^stack: [0-9a-f ]+$/.test(line.trim())).join('\n').split(directory).join('<sandbox>').slice(-2000);
  return { phase: /Uncaught|SyntaxError|No such module|ReferenceError|TypeError|Error/.test(detail) ? 'load_failed' : 'sandbox_failed', detail: detail || `workerd exited with code ${result.code}` };
 } finally { await rm(directory, { recursive: true, force: true }); }
}
