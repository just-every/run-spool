#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const CHUNK = 65_536;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
/** The namespace the import door keeps one Sentry organization's lineage under. */
export const sentryNamespace = organization => `sentry-org:${organization}`;
function organizationOf(bytes) {
  let bundle;
  try { bundle = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('Export bundle is not JSON'); }
  const slug = bundle?.organization?.slug;
  if (typeof slug !== 'string' || !slug) throw new Error('Export bundle names no organization slug');
  return slug;
}

/** Spool's owner-session import client: every call goes through the import
 * door at /api/operator/import/* with the owner's cookie and exact Origin.
 * `transport(action, body, namespace)` replaces that HTTP call for a caller
 * that already holds its own authenticated request (a test runtime). */
export function sentryDoorClient({ endpoint, cookie, organization, transport }) {
  transport ??= (action, body, namespace) => {
    const origin = new URL(endpoint).origin;
    return fetch(`${origin}/api/operator/import/${action}`, { method: 'POST', redirect: 'error',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-Import-Source': namespace }, body: JSON.stringify(body) });
  };
  async function call(action, body, namespace = sentryNamespace(organization)) {
    let response;
    try { response = await transport(action, body, namespace); } catch { throw new Error('Spool import transport failed'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`Spool import refused (HTTP ${response.status}${result.error ? `: ${result.error}` : ''})`), { status: response.status, code: result.error });
    return result;
  }
  async function until(action, body, state) {
    for (let batch = 0; batch < 100; batch++) {
      const result = await call(action, body);
      if (result.job?.state === state) return result;
      if (!['queued', 'applying', 'undoing'].includes(result.job?.state)) throw new Error(`Import ${action} stopped in state ${result.job?.state}`);
    }
    throw new Error(`Import ${action} did not finish within 100 bounded requests`);
  }
  return {
    call,
    /** Uploads the exact bytes in checked chunks and returns the server's inventory. */
    async upload(bytes, name = 'sentry-organization.json') {
      organization ??= organizationOf(bytes);
      const bundleSha256 = sha256(bytes), totalChunks = Math.ceil(bytes.length / CHUNK);
      let uploadId;
      for (let index = 0; index < totalChunks; index++) {
        const chunk = bytes.subarray(index * CHUNK, (index + 1) * CHUNK);
        uploadId = (await call('uploads', { ...uploadId ? { uploadId } : {}, name, bundleSha256, totalBytes: bytes.length, totalChunks, index,
          chunkSha256: sha256(chunk), base64: Buffer.from(chunk).toString('base64') })).uploadId;
      }
      const inventory = await call('uploads', { uploadId });
      if (!inventory.complete || inventory.bundleSha256 !== bundleSha256) throw new Error('Upload incomplete');
      return inventory;
    },
    /** Upload and plan: counts, rejections and differences, and the fingerprint to review. Writes no native records. */
    async plan(bytes, { catchup } = {}) {
      const { uploadId } = await this.upload(bytes);
      return { organization, namespace: sentryNamespace(organization), uploadId, ...await call('plan', { uploadId, ...catchup ? { catchup: true } : {} }) };
    },
    apply: (planId, reviewedFingerprint) => until('apply', { planId, reviewedFingerprint }, 'completed'),
    status: planId => call('status', { planId }),
    reconcile: planId => call('reconcile', { planId }),
    undo: planId => until('undo', { planId }, 'undone'),
    get organization() { return organization; },
  };
}

export async function sentryImportCli(args) {
  const [action, ...rest] = args, options = {};
  const verbs = ['dry-run', 'apply', 'status', 'reconcile', 'undo', 'read', 'originals', 'resume'];
  if (!verbs.includes(action)) throw new Error(`Expected ${verbs.join(', ')}`);
  const names = new Map([['--endpoint', 'endpoint'], ['--session-env', 'sessionEnv'], ['--file', 'file'], ['--organization', 'organization'], ['--fingerprint', 'fingerprint'], ['--plan', 'plan'], ['--job', 'job'], ['--output', 'output']]);
  for (let index = 0; index < rest.length; index++) {
    if (rest[index] === '--catchup' && !options.catchup) { options.catchup = true; continue; }
    const name = names.get(rest[index]);
    if (!name || options[name] || !rest[index + 1] || rest[index + 1].startsWith('--')) throw new Error('Invalid or duplicate option');
    options[name] = rest[++index];
  }
  const endpoint = new URL(options.endpoint);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/' || !['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Endpoint must be an HTTP(S) origin without credentials');
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Owner session requires HTTPS outside loopback');
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(options.sessionEnv ?? '') || !process.env[options.sessionEnv]) throw new Error('session-env must name a populated owner session environment variable');
  const cookie = process.env[options.sessionEnv];
  if (action === 'dry-run') {
    if (!options.file) throw new Error('file is required');
    const bytes = await readFile(options.file); if (bytes.length > 2 * 1024 * 1024) throw new Error('Export bundle exceeds 2 MiB');
    return sentryDoorClient({ endpoint: endpoint.origin, cookie }).plan(bytes, { catchup: options.catchup });
  }
  if (!options.organization) throw new Error('organization is required');
  if (['read', 'originals', 'resume'].includes(action) || (action === 'undo' && options.job)) return legacyJob(action, endpoint.origin, cookie, options);
  if (!options.plan) throw new Error('plan is required');
  const client = sentryDoorClient({ endpoint: endpoint.origin, cookie, organization: options.organization });
  if (action === 'apply') {
    if (!/^[a-f0-9]{64}$/.test(options.fingerprint ?? '')) throw new Error('The reviewed fingerprint is required');
    return client.apply(options.plan, options.fingerprint);
  }
  return client[action](options.plan);
}

/** Jobs the owner-session importer created before the import door: journal, private originals, resume and undo. */
async function legacyJob(action, origin, cookie, options) {
  if (!options.job) throw new Error('job is required');
  if (action === 'originals' && !options.output) throw new Error('Originals require --output FILE');
  let path = `/api/imports/sentry/${encodeURIComponent(options.organization)}/${encodeURIComponent(options.job)}`, method = 'GET';
  if (action === 'originals') path += '/originals';
  if (['resume', 'undo'].includes(action)) { path += `/${action}`; method = 'POST'; }
  let response;
  try { response = await fetch(origin + path, { method, redirect: 'error', headers: { Origin: origin, Cookie: cookie } }); } catch { throw new Error('Spool import transport failed'); }
  if (!response.ok) throw new Error(`Spool import refused (HTTP ${response.status}); inspect the authenticated workbench for the safe reason`);
  const result = await response.json();
  if (action === 'originals') { await writeFile(options.output, JSON.stringify(result), { mode: 0o600, flag: 'wx' }); return { saved: true }; }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) sentryImportCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
