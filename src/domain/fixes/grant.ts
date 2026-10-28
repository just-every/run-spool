import { agentRequestContext } from '../agent-door/native-context';
import { hash, identity } from '../privacy';

// The exact grant an owner approves for one fix branch. Spool refuses any call
// outside it, and the provider token it mints carries only these permissions
// for this one repository and is revoked after each step.
export const FIX_OPERATIONS = ['mint_token', 'read_base', 'create_branch', 'commit_file', 'open_draft_pull_request', 'read_pull_request', 'read_checks', 'compare_commits', 'revoke_token'] as const;
export type FixOperation = typeof FIX_OPERATIONS[number];
export const FIX_PERMISSIONS = { contents: 'write', pull_requests: 'write', checks: 'read' };
export const NEVER = ['write to the base branch or any branch other than the fix branch', 'merge a pull request', 'force-push or delete a branch', 'create a tag or release', 'deploy'];
const repositoryPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const refPattern = /^(?!.*\.\.)(?!.*\/\/)(?!\/)(?!.*\/$)(?!.*\.lock$)[A-Za-z0-9._/-]{1,200}$/;

export function proposalInput(body: any) {
 if (typeof body.repository !== 'string' || !repositoryPattern.test(body.repository) || /\.git$/.test(body.repository)) throw new Error('Repository must be owner/name');
 const base = body.base === undefined ? 'main' : body.base;
 if (typeof base !== 'string' || !refPattern.test(base)) throw new Error('Base branch name is invalid');
 const duration = body.durationMinutes === undefined ? 60 : body.durationMinutes;
 if (!Number.isSafeInteger(duration) || duration < 1 || duration > 10080) throw new Error('Grant duration must be 1 to 10080 minutes');
 return { repository: body.repository as string, base: base as string, flow: identity(body.flow, 'flow'), durationMinutes: duration as number };
}

// The one file the branch adds: the reproducer record as data. It is never
// code, so nothing captured can execute in the repository's CI.
export function reproducerFile(reproducer: any, run: any) {
 const spec = reproducer.spec, original = spec.event.frame.original, module = spec.source.modules.find((m: any) => m.name === spec.call.module);
 return JSON.stringify({
  kind: 'spool-reproducer', version: 1, note: 'Data only. Write a regression test that makes this call and expects it not to throw the captured exception.',
  reproducer: reproducer.id, issue: reproducer.issue, defectClass: spec.defectClass,
  captured: { event: spec.event.id, release: spec.event.release, type: spec.event.type, message: spec.event.message, frame: original },
  call: { module: module.original, export: spec.call.export, input: spec.call.input },
  sandbox: spec.environment,
  run: { id: run.id, release: run.release, outcome: run.outcome, reason: run.reason, tools: run.tools },
 }, null, 2) + '\n';
}

export async function grantSpec(id: string, input: ReturnType<typeof proposalInput>, reproducer: any, run: any) {
 const actor=agentRequestContext()?.actor.label;
 const content = reproducerFile(reproducer, run), branch = `spool/fix-${id.slice(0, 8)}`;
 return {
  version: 1, provider: 'github', repository: input.repository, base: input.base, branch,
  file: { path: `.spool/reproducers/${reproducer.id}.json`, sha256: await hash(content), bytes: new TextEncoder().encode(content).length },
  pullRequest: { title: `Fix ${reproducer.spec.event.type} reproduced by Spool`.slice(0, 200), draft: true,
   body: `Spool reproduced this failure in its isolated sandbox (run ${run.id}): ${run.reason}\n\nThis branch adds \`.spool/reproducers/${reproducer.id}.json\`, the reproducer record. It is data, not code.${actor?' Prepared by '+actor+'.':''} Push the fix to this branch; Spool reads this pull request's state and checks and never merges it.` },
  operations: [...FIX_OPERATIONS], permissions: FIX_PERMISSIONS, durationMinutes: input.durationMinutes, never: NEVER,
 };
}
