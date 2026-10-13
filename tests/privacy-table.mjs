import {queuedEntrypoint} from '../scripts/base-onboarding/queued-entry.mjs';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
// Privacy table: plants one native-ingest issue per secret form (message, title
// and breadcrumbs) and one Sentry store event, delivers alerts, then reads all
// 14 output paths and requires every secret gone and every ordinary line kept.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { alertRuntime, rule } from './alerts/runtime.mjs';
import { receiver } from './alerts/receiver.mjs';
import { forms, ordinary } from './privacy-table/forms.mjs';
const root = process.cwd();
const outDir = resolve('.artifacts/privacy-table');
const stateDir = await mkdtemp(resolve(tmpdir(), 'spool-privacy-'));
await mkdir(outDir, { recursive: true });
const ordText = ordinary.map(([, t]) => t).join('\n');
// JSON outputs escape newlines, so each ordinary line is looked for on its own.
const scan = text => ({ secrets: [...forms.filter(([, , s]) => s.some(part => text.includes(part))).map(([n]) => n), ...(text.includes('SFCNRY') ? ['Sentry dropped fields'] : [])], ordinaryLost: ordinary.filter(([, t]) => t.split('\n').some(line => !text.includes(line))).map(([n]) => n) });
const results = {};
async function record(label, value) { const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1); await writeFile(resolve(outDir, label.replace(/[^a-z0-9.-]+/gi, '_') + '.txt'), text); results[label] = scan(text); }
const agentBin = resolve(root, 'packages/agent/bin/spool-agent.mjs');
const cli = (origin, key, args) => new Promise((ok, no) => { const c = spawn(process.execPath, [agentBin, ...args], { env: { ...process.env, SPOOL_URL: origin + '/api/projects/web', SPOOL_AGENT_KEY: key }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d); c.once('error', no); c.once('close', code => ok({ code, out })); });
async function mcp(origin, key, calls) {
  const require = createRequire(resolve(root, 'packages/agent/package.json'));
  const { Client } = await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
  const { StdioClientTransport } = await import(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
  const client = new Client({ name: 'privacy-table', version: '1' }, { capabilities: {} });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [agentBin, 'mcp'], env: { ...process.env, SPOOL_URL: origin + '/api/projects/web', SPOOL_AGENT_KEY: key }, stderr: 'pipe' }));
  try { const out = {}; for (const [n, a] of calls) out[n] = await client.callTool({ name: n, arguments: a }); return out; } finally { await client.close(); }
}
const rcv = await receiver(resolve(stateDir, 'receiver.sqlite'));
const app = await alertRuntime(rcv, { state: resolve(stateDir, 'state') });
try {
  const project = await app.json('/api/projects', 'POST', { id: 'web', name: 'Privacy table' });
  await app.json('/api/projects/web/releases', 'POST', { name: 'r1', build: 'b1' });
  for (const ch of ['mail', 'webhook']) await app.json('/api/projects/web/alerting/rules', 'POST', rule(ch, { kinds: ['new_issue', 'regression'] }));
  const issues = {};
  for (const [i, [name, text]] of forms.entries()) {
    const ev = { version: 1, eventId: 'scrub-' + i, release: 'r1', build: 'b1', environment: 'proof', type: 'Error', message: ordText + '\n' + text,
      frames: [{ file: 'https://app.example.com/main.js', line: 10 + i, column: 0, function: 'form' + i }], breadcrumbs: [ordText, text] };
    const r = await app.request('/api/ingest/web', 'POST', ev, { Authorization: 'Bearer ' + project.ingestKey });
    const body = await r.json(); assert.equal(r.status, 201, JSON.stringify(body)); issues[name] = body.issue;
  }
  const dsn = new URL(project.dsn);
  const sentry = await app.request(`/api/${dsn.pathname.slice(1)}/store/?sentry_key=${dsn.username}&sentry_version=7`, 'POST', { event_id: 'f'.repeat(32), release: 'r1', dist: 'b1', environment: 'proof', platform: 'javascript',
    exception: { values: [{ type: 'Error', value: ordText, stacktrace: { frames: [{ filename: 'https://app.example.com/main.js', lineno: 99, colno: 1, function: 'sentryForm', vars: { password: 'SFCNRYlocals' } }] } }] },
    breadcrumbs: { values: [{ category: 'http', message: 'POST /login', data: { password: 'SFCNRYcrumbdata' } }] },
    request: { url: 'https://app.example.com/login?token=SFCNRYquery', headers: { Authorization: 'Bearer SFCNRYhdr', Cookie: 'sid=SFCNRYcookie' }, data: { password: 'SFCNRYdata' } },
    tags: { api_key: 'SFCNRYtag' }, contexts: { app: { secret: 'SFCNRYctx' } }, extra: { token: 'SFCNRYextra' } }, { Cookie: '' });
  assert.equal(sentry.status, 200, await sentry.text());
  issues.sentry = (await app.json('/api/projects/web/issues?limit=100')).find(row => !Object.values(issues).includes(row.id)).id;
  for (let n = 0; n < 3; n++) await app.schedule(Date.now());
  await record('alert webhook payloads', rcv.requests.map(r => JSON.parse(r.body)));
  await record('alert email', (await app.db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY rowid').all()).results.map(r => JSON.parse(r.message)));
  const agentKey = (await app.json('/api/projects/web/keys', 'POST', { kind: 'agent' })).key;
  const agent = p => fetch(app.origin + p, { headers: { Authorization: 'Bearer ' + agentKey } }).then(r => { assert.equal(r.status, 200, p); return r.json(); });
  await record('owner issue list', await app.json('/api/projects/web/issues?limit=100'));
  await record('owner alert feed', await app.json('/api/projects/web/alerts'));
  await record('agent issue list', await agent('/api/projects/web/issues?limit=100'));
  await record('agent alerts', await agent('/api/projects/web/alerts'));
  const ci = await cli(app.origin, agentKey, ['issues', '--state', 'all', '--limit', '100']); assert.equal(ci.code, 0, ci.out); await record('CLI issues', ci.out);
  const acc = { 'owner issue page (packet)': '', 'agent packet': '', 'CLI packet markdown': '', 'CLI packet json': '', 'MCP get_packet': '', 'MCP list_issues': '' };
  for (const id of Object.values(issues)) {
    acc['owner issue page (packet)'] += JSON.stringify(await app.json(`/api/projects/web/issues/${id}/packet`));
    acc['agent packet'] += JSON.stringify(await agent(`/api/projects/web/issues/${id}/packet`));
    for (const f of ['markdown', 'json']) { const r = await cli(app.origin, agentKey, ['packet', id, '--format', f]); assert.equal(r.code, 0, r.out); acc['CLI packet ' + f] += r.out; }
    const t = await mcp(app.origin, agentKey, [['get_packet', { issue: id }], ['list_issues', { state: 'all', limit: 100 }]]);
    acc['MCP get_packet'] += JSON.stringify(t.get_packet); acc['MCP list_issues'] = JSON.stringify(t.list_issues);
  }
  for (const [k, v] of Object.entries(acc)) await record(k, v);
  const archive = await app.request('/api/archive'); assert.equal(archive.status, 200); await record('archive export', await archive.text());
} finally { await writeFile(resolve(outDir, 'summary.json'), JSON.stringify(results, null, 1)); await app.close(); await rcv.close(); await rm(stateDir, { recursive: true, force: true }); }
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(28), 'secrets', v.secrets.length, '| ordinary lost:', v.ordinaryLost.join(', ') || 'none');
assert.equal(Object.keys(results).length, 14, 'all 14 output paths read');
for (const [path, { secrets, ordinaryLost }] of Object.entries(results)) {
  assert.deepEqual(secrets, [], `${path}: secrets survive`);
  assert.deepEqual(ordinaryLost, [], `${path}: ordinary text changed`);
}
