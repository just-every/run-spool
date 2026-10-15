import { hash } from '../privacy';

/** Provider write results for disposable demos; public repository reads stay real. */
export async function demoWrite(step: string, repository: string, body: any = {}, workflow: any = {}): Promise<Response> {
 const sha = (await hash(JSON.stringify({ step, repository, body }))).slice(0, 40);
 switch (step) {
  case 'mint_token': return Response.json({ token: 'demo', expires_at: new Date(Date.now() + 3600000).toISOString(), permissions: body.permissions, repositories: [{ full_name: repository }] }, { status: 201 });
  case 'create_branch': return Response.json({ ref: body.ref, object: { sha: body.sha } }, { status: 201 });
  case 'commit_file': return Response.json({ content: { path: body.path }, commit: { sha } }, { status: 201 });
  case 'open_draft_pull_request': return Response.json({ number: 1, html_url: `https://github.com/${repository}/pull/1`, draft: true, head: { sha } }, { status: 201 });
  // These entities exist only in this demo's write results, never on GitHub.
  case 'read_pull_request': return Response.json({ state: 'open', merged: false, head: { sha: workflow.head_sha } });
  case 'read_checks': return Response.json({ total_count: 0, check_runs: [] });
  case 'revoke_token': return new Response(null, { status: 204 });
  default: throw new Error(`Unsupported demo provider write: ${step}`);
 }
}
