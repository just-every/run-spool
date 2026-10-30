import { file, scrub } from '../privacy';
import { reductionPlan, REDUCTION } from './reduction.mjs';

// The runner reports only what the sandbox observed. Spool decides the outcome
// here by comparing that behaviour with the captured event; a report cannot
// say "reproduced", and its shape is refused if it tries.
const PHASES: Record<string, string[]> = {
 threw: ['name', 'message', 'stack'], returned: ['type', 'preview'], entry_missing: ['type'],
 load_failed: ['detail'], timed_out: ['afterMs'], sandbox_failed: ['detail'],
};
const FAILED: Record<string, string> = {
 entry_missing: 'The chosen export is not a function of the mapped module.',
 load_failed: 'The sandbox could not load the modules (a syntax error, or an import the map does not carry).',
 timed_out: 'The call did not finish before the sandbox was killed.',
 sandbox_failed: 'The sandbox process failed before it reported an observation.',
};
const bounded = (value: unknown, max: number) => { if (typeof value !== 'string' || value.length > max) throw new Error('Invalid observation'); return scrub(value); };
function shape(value: any, keys: string[]) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error('Invalid observation'); }

export function reportInput(body: any) {
 shape(body, ['protocol', 'tools', 'observation', ...(body?.trials === undefined ? [] : ['trials'])]);
 if (body.protocol !== 1) throw new Error('Unsupported runner protocol');
 shape(body.tools, ['workerd', 'node', 'runner']);
 const tools = { workerd: bounded(body.tools.workerd, 100), node: bounded(body.tools.node, 40), runner: bounded(body.tools.runner, 40) };
 const o = body.observation, fields = PHASES[o?.phase];
 if (!fields) throw new Error('Invalid observation');
 shape(o, ['phase', ...fields]);
 const observation: any = { phase: o.phase };
 if (o.phase === 'threw') Object.assign(observation, { name: bounded(o.name, 200), message: bounded(o.message, 2000), stack: bounded(o.stack, 8000) });
 if (o.phase === 'returned') Object.assign(observation, { type: bounded(o.type, 40), preview: bounded(o.preview, 500) });
 if (o.phase === 'entry_missing') observation.type = bounded(o.type, 40);
 if (o.phase === 'load_failed' || o.phase === 'sandbox_failed') observation.detail = bounded(o.detail, 2000);
 if (o.phase === 'timed_out') { if (!Number.isSafeInteger(o.afterMs) || o.afterMs < 0) throw new Error('Invalid observation'); observation.afterMs = o.afterMs; }
 let trials;
 if (body.trials !== undefined) {
  if (!Array.isArray(body.trials) || body.trials.length > REDUCTION.maxTrials) throw new Error('Invalid trial budget');
  trials = body.trials.map((trial: any) => {
   // Trials carry observations only, never nested experiments or outcomes.
   return reportInput({ protocol: 1, tools, observation: trial }).observation;
  });
 }
 return { tools, observation, trials };
}

export function analysisCheck(spec: any, modules: { name: string; original: string }[], baseline: string, trials: any[] | undefined) {
 if (!spec.analysis) { if (trials !== undefined) throw new Error('No analysis was authorized'); return null; }
 if (!trials) throw new Error('Analysis observations required');
 if (baseline !== 'reproduced') {
  if (trials.length) throw new Error('Analysis needs a reproduced baseline');
  return { minimal: false, stop: 'baseline_not_reproduced', input: null, trials: [] };
 }
 const plan = reductionPlan(spec.call.input, spec.analysis.experiments), receipts = [];
 for (const observation of trials) {
  const trial = plan.next();
  if (!trial) throw new Error('Trial exceeds the authorized plan');
  const result = behaviourCheck(spec, modules, observation);
  receipts.push({ ...trial, observation, ...result });
  plan.observe(result.outcome);
 }
 plan.next(); // Establish exhaustion; an unobserved candidate is not minimal.
 return { ...plan.result(), trials: receipts };
}

// V8 frame lines: "at fn (module:line:column)" or "at module:line:column".
function firstFrame(stack: string) {
 for (const line of stack.split('\n')) {
  const match = /^\s*at (?:(.*?) \()?([^()\s]+):(\d+):(\d+)\)?$/.exec(line);
  if (match) return { function: match[1] ?? '', module: match[2], line: Number(match[3]), column: Number(match[4]) };
 }
 return null;
}
type Check = { check: string; expected: unknown; observed: unknown; passed: boolean; required: boolean };
export function behaviourCheck(spec: any, modules: { name: string; original: string }[], observation: any) {
 if (FAILED[observation.phase]) return { outcome: 'failed' as const, reason: FAILED[observation.phase], checks: [] as Check[] };
 const expected = spec.event, original = expected.frame.original;
 if (observation.phase === 'returned') return { outcome: 'not_reproduced' as const, reason: `The call returned ${observation.type} instead of throwing ${expected.type}.`, checks: [{ check: 'threw', expected: true, observed: false, passed: false, required: true }] };
 const frame = firstFrame(observation.stack), module = frame && modules.find(row => row.name === frame.module);
 const checks: Check[] = [
  { check: 'exception_type', expected: expected.type, observed: observation.name, passed: observation.name === expected.type, required: true },
  { check: 'message', expected: expected.message, observed: observation.message, passed: observation.message === expected.message, required: true },
  { check: 'frame_source', expected: original.file, observed: module ? file(module.original) : frame?.module ?? null, passed: !!module && file(module.original) === original.file, required: true },
  { check: 'frame_line', expected: original.line, observed: frame?.line ?? null, passed: frame?.line === original.line, required: true },
  // Maps point at an expression start (0-based); V8 reports the throwing token (1-based). Shown, not required.
  { check: 'frame_column', expected: original.column, observed: frame ? frame.column - 1 : null, passed: !!frame && frame.column - 1 === original.column, required: false },
 ];
 const failed = checks.filter(row => row.required && !row.passed);
 return failed.length
  ? { outcome: 'not_reproduced' as const, reason: `The sandbox threw, but ${failed.map(row => row.check.replace('_', ' ')).join(', ')} did not match the captured event.`, checks }
  : { outcome: 'reproduced' as const, reason: `The sandbox threw ${expected.type} with the captured message at ${original.file}:${original.line}, the captured mapped frame.`, checks };
}
