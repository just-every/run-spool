#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { importConnection, importDoorClient, MAX_BUNDLE_BYTES } from './import-door-client.mjs';

/** Bugsnag organization IDs own their lineage independently of Sentry. */
export const bugsnagNamespace = organization => `bugsnag-org:${organization}`;
function organizationOf(bytes) {
  let bundle;
  try { bundle = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('Export bundle is not JSON'); }
  if (bundle?.format !== 'spool-bugsnag-org-export' || bundle.version !== 1) throw new Error('Expected spool-bugsnag-org-export version 1');
  const id = bundle?.organization?.id;
  if (typeof id !== 'string' || !id || id.length > 200 || /[\s\x00-\x1f\x7f]/.test(id)) throw new Error('Export bundle names no valid organization id');
  return id;
}

export function bugsnagDoorClient(options) {
  const client = importDoorClient({ ...options, namespaceOf: bugsnagNamespace, organizationOf, uploadName: 'bugsnag-organization.json' });
  client.resume = client.apply;
  return client;
}

export async function bugsnagImportCli(args) {
  const [action, ...rest] = args, options = {};
  const verbs = ['dry-run', 'apply', 'status', 'reconcile', 'undo', 'resume'];
  if (!verbs.includes(action)) throw new Error(`Expected ${verbs.join(', ')}`);
  const names = new Map([['--endpoint', 'endpoint'], ['--session-env', 'sessionEnv'], ['--file', 'file'], ['--organization', 'organization'], ['--fingerprint', 'fingerprint'], ['--plan', 'plan']]);
  for (let index = 0; index < rest.length; index++) {
    if (rest[index] === '--catchup' && !options.catchup) { options.catchup = true; continue; }
    const name = names.get(rest[index]);
    if (!name || options[name] || !rest[index + 1] || rest[index + 1].startsWith('--')) throw new Error('Invalid or duplicate option');
    options[name] = rest[++index];
  }
  const connection = importConnection(options);
  if (action === 'dry-run') {
    if (!options.file) throw new Error('file is required');
    let bytes;
    try { bytes = await readFile(options.file); } catch { throw new Error('Export bundle could not be read'); }
    if (bytes.length > MAX_BUNDLE_BYTES) throw new Error('Export bundle exceeds 2 MiB');
    const organization = organizationOf(bytes);
    if (options.organization && options.organization !== organization) throw new Error('Export organization does not match --organization');
    return bugsnagDoorClient(connection).plan(bytes, { catchup: options.catchup });
  }
  if (!options.organization) throw new Error('organization is required');
  if (!options.plan) throw new Error('plan is required');
  const client = bugsnagDoorClient({ ...connection, organization: options.organization });
  if (['apply', 'resume'].includes(action)) {
    if (!/^[a-f0-9]{64}$/.test(options.fingerprint ?? '')) throw new Error('The reviewed fingerprint is required');
    return client.apply(options.plan, options.fingerprint);
  }
  return client[action](options.plan);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) bugsnagImportCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
