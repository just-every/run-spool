import { validateMap } from '../domain/artifacts';
import { deploymentInput } from '../domain/operators/validation';
import { ruleInput } from '../domain/alerts/rules';
import api from '../domain/api';
import { wrapRequest } from '../domain/audit/request';
import { hash } from '../domain/privacy';
import { runtimeBindings, type Bindings } from '../auth/bindings';
import { demoEnvironment, demoProject } from './environment';
import { groups, releases, sampleEvent } from './data';

const sources = [
 'export function calculateTotal(cart) { return cart.items.reduce((sum, item) => sum + cart.prices[item.sku].price, 0); }',
 'export async function reserveInventory(client) { return client.reserve({ timeout: 5000 }); }',
 'export async function searchProducts(client, query) { return client.search(query); }',
 'export function formatDeliveryDate(value) { return new Date(value).toISOString(); }',
 'export function validateAddress(address) { return address.postalCode.trim(); }',
 'export async function loadThumbnail(decoder, bytes) { return decoder.decode(bytes); }',
 'export function handleAction(action) { return action(); }',
];
const vlq = (value: number) => {
 let n = value < 0 ? (-value * 2 + 1) : value * 2, result = '';
 do { let digit = n & 31; n >>>= 5; if (n) digit |= 32; result += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[digit]; } while (n);
 return result;
};

/** Register real, validated source and deployment evidence for the sample releases. */
export async function seedWorkspace(env: Bindings, start: number) {
 const db = env.DB, project = demoProject;
 const files = [...groups.map(group => group.file), '/src/app.js'];
 const map = { version: 3, sources: files, names: [], sourcesContent: sources,
  mappings: files.map((_, index) => 'A' + vlq(index ? 1 : 0) + 'AA').join(';') };
 const payload = validateMap(map), digest = await hash(payload);
 for (const [index, release] of releases.entries()) {
  await db.prepare('INSERT INTO artifacts(project,release,build,debug,payload,digest,created,occurrence) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(project,release,build,debug) DO NOTHING')
   .bind(project, release.name, release.build, 'cedar-storefront', payload, digest, start + index * 172800000, crypto.randomUUID()).run();
  for (const environment of ['staging', 'production']) {
   const manifest = deploymentInput({ environment, commitSha: (await hash(release.build)).slice(0, 40),
    repository: 'https://github.com/just-every/run-spool', deployedAt: new Date(start + index * 172800000).toISOString() });
   await db.prepare('INSERT INTO deployment_manifests VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,release,environment) DO NOTHING')
    .bind(project, release.name, environment, manifest.commit_sha, manifest.repository, manifest.deployed_at, manifest.deployed_at).run();
  }
 }
 const configured = demoEnvironment(env);
 const rule = ruleInput({ name: 'Storefront new issues and regressions', enabled: true, channel: 'mail', destination: 'demo-mail', kinds: ['new_issue', 'regression'], windowMs: 300000, threshold: 10 }, configured, project, false);
 await db.prepare('INSERT INTO alert_rules VALUES(?,?,1,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
  .bind('cedar-owner-alerts', project, rule.name, 1, rule.channel, rule.destination, rule.kinds, rule.windowMs, rule.threshold, start, start).run();
}

/** Recent samples pass the same admission and silent delivery path as incoming SDK events. */
export async function seedRecentCapture(env: Bindings) {
 const configured = runtimeBindings(env), db = env.DB;
 const key = crypto.randomUUID(), keyHash = await hash(key);
 await db.prepare("INSERT INTO credentials(hash,project,kind,created) VALUES(?,?,'ingest',?)").bind(keyHash, demoProject, Date.now()).run();
 try {
  const tasks: Promise<unknown>[] = [];
  const execution = { waitUntil(task: Promise<unknown>) { tasks.push(task); }, passThroughOnException() { throw new Error('Demo seed cannot pass through'); }, props: {} };
  for (const [index, group] of groups.slice(0, 3).entries()) {
   const event = { ...sampleEvent(group, index, group.count - 1), eventId: `cedar-live-${index}`, environment: 'production' };
   const request = new Request(`${configured.AUTH_ORIGIN}/api/ingest/${demoProject}`, { method: 'POST', headers: { Host: new URL(configured.AUTH_ORIGIN).host, 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(event) });
   // The demo hook runs before the outer HTTP audit scope. Enter the normal
   // ingest door directly, without recursively invoking withDemo.
   const response = await wrapRequest(request, configured, async () => api.fetch(request, configured, execution));
   if (!response.ok) throw new Error(`Demo recent capture failed: ${response.status}`);
   await response.body?.cancel();
  }
  await Promise.all(tasks);
 } finally { await db.prepare('DELETE FROM credentials WHERE hash=?').bind(keyHash).run(); }
}
