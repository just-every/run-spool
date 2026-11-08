// A deterministic deletion search over JSON arguments. Source, export and
// sandbox authority stay fixed. A completed search is one-deletion minimal,
// not a claim of global minimality or a confirmed causal explanation.
export const REDUCTION = { maxTrials: 12, wallClockMs: 30000 };

export function matchesCapture(expected, observation) {
 if (observation.phase !== 'threw' || observation.name !== expected.type || observation.message !== expected.message) return false;
 for (const line of observation.stack.split('\n')) {
  const frame = /^\s*at (?:(.*?) \()?([^()\s]+):(\d+):(\d+)\)?$/.exec(line);
  if (frame) return frame[2] === expected.module && Number(frame[3]) === expected.line;
 }
 return false;
}

function* paths(value, prefix = []) {
 if (!value || typeof value !== 'object') return;
 for (const key of Object.keys(value)) {
  const path = [...prefix, Array.isArray(value) ? Number(key) : key];
  yield path;
  yield* paths(value[key], path);
 }
}
function* deletions(input) {
 for (const path of paths(input)) {
  const next = JSON.parse(JSON.stringify(input));
  let parent = next;
  for (const key of path.slice(0, -1)) parent = parent[key];
  const key = path.at(-1);
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete parent[key];
  yield next;
 }
}

// Both ends replay this plan. The server reconstructs each input and decides
// its outcome independently; a report cannot choose another experiment or
// declare an unsuccessful setup to be a passing reduction.
export function reductionPlan(input, experiments) {
 let current = input, candidates = deletions(current), experiment = 0;
 let pending = null, trials = 0, exhausted = false, uncertain = false;
 return {
  next() {
   if (pending) throw new Error('An observation is required');
   if (trials >= REDUCTION.maxTrials) return null;
   if (experiment < experiments.length) {
    pending = { kind: 'experiment', name: experiments[experiment].name, input: experiments[experiment++].input };
   } else {
    const next = candidates.next();
    if (next.done) { exhausted = true; return null; }
    pending = { kind: 'reduction', input: next.value };
   }
   return pending;
  },
  observe(outcome) {
   if (!pending) throw new Error('No trial is pending');
   if (pending.kind === 'reduction') {
    if (outcome === 'reproduced') { current = pending.input; candidates = deletions(current); uncertain = false; }
    else if (outcome === 'failed') uncertain = true;
   }
   trials++; pending = null;
  },
  result() {
   return { input: current, trials, minimal: exhausted && !uncertain, stop: exhausted ? (uncertain ? 'inconclusive_trial' : 'complete') : trials >= REDUCTION.maxTrials ? 'trial_budget' : 'time_budget' };
  },
 };
}
