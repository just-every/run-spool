#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { importConnection, importDoorClient, MAX_BUNDLE_BYTES } from './import-door-client.mjs';

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
  return importDoorClient({ endpoint, cookie, organization, transport, namespaceOf: sentryNamespace, organizationOf, uploadName: 'sentry-organization.json' });
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
  const { endpoint, cookie } = importConnection(options);
  if (action === 'dry-run') {
    if (!options.file) throw new Error('file is required');
    const bytes = await readFile(options.file); if (bytes.length > MAX_BUNDLE_BYTES) throw new Error('Export bundle exceeds 2 MiB');
    return sentryDoorClient({ endpoint: endpoint, cookie }).plan(bytes, { catchup: options.catchup });
  }
  if (!options.organization) throw new Error('organization is required');
  if (['read', 'originals', 'resume'].includes(action) || (action === 'undo' && options.job)) return legacyJob(action, endpoint, cookie, options);
  if (!options.plan) throw new Error('plan is required');
  const client = sentryDoorClient({ endpoint: endpoint, cookie, organization: options.organization });
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
