// pnpm reproduce <run url>: fetch one queued reproducer run with its single-use
// token (SPOOL_RUN_TOKEN), execute it in the isolated sandbox and report what
// the sandbox observed. Spool, not this runner, decides whether it reproduced.
import { runSandbox, sandboxVersion } from './sandbox.mjs';
import { matchesCapture, reductionPlan, REDUCTION } from '../../src/domain/reproducers/reduction.mjs';

const [url] = process.argv.slice(2), secret = process.env.SPOOL_RUN_TOKEN;
if (!url || !/^https?:\/\/[^/]+\/api\/sandbox\/runs\/[0-9a-f-]{36}$/.test(url) || !secret) {
 console.error('Usage: SPOOL_RUN_TOKEN=<token> pnpm reproduce <run url>');
 process.exit(2);
}
const headers = { Authorization: `Bearer ${secret}` };
const fetched = await fetch(url, { headers });
if (!fetched.ok) { console.error(`Job not available: HTTP ${fetched.status} ${(await fetched.json().catch(() => ({}))).error ?? ''}`); process.exit(1); }
const job = await fetched.json();
let observation, trials;
const started = Date.now();
try { observation = await runSandbox(job); }
catch (error) { observation = { phase: 'sandbox_failed', detail: String(error.message).slice(0, 2000) }; }
if (job.analysis) {
 trials = [];
 if (job.analysis.maxTrials !== REDUCTION.maxTrials || job.analysis.wallClockMs !== REDUCTION.wallClockMs || !Array.isArray(job.analysis.experiments) || job.analysis.experiments.length > 3) throw new Error('Refused analysis budget');
 if (matchesCapture(job.expected, observation)) {
  const plan = reductionPlan(job.call.input, job.analysis.experiments);
  for (;;) {
   const remaining = REDUCTION.wallClockMs - (Date.now() - started);
   if (remaining <= 0) break;
   const trial = plan.next(); if (!trial) break;
   let observed;
   try { observed = await runSandbox({ ...job, call: { ...job.call, input: trial.input } }, remaining); }
   catch (error) { observed = { phase: 'sandbox_failed', detail: String(error.message).slice(0, 2000) }; }
   trials.push(observed);
   plan.observe(matchesCapture(job.expected, observed) ? 'reproduced' : observed.phase === 'threw' || observed.phase === 'returned' ? 'not_reproduced' : 'failed');
  }
 }
}
const tools = { workerd: (await sandboxVersion().catch(() => 'unknown')).slice(0, 100), node: process.version, runner: 'spool-runner/1' };
const reported = await fetch(`${url}/observation`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: 1, tools, observation, ...(trials ? { trials } : {}) }) });
const result = await reported.json().catch(() => ({}));
if (!reported.ok) { console.error(`Report refused: HTTP ${reported.status} ${result.error ?? ''}`); process.exit(1); }
console.log(`${result.outcome}: ${result.reason}`);
