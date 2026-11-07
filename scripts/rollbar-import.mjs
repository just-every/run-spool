#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sentryDoorClient } from './sentry-import.mjs';
import { compareRollbarExport } from './rollbar-compare.mjs';

/** The namespace the import door keeps one Rollbar project's lineage under: account and project, so two accounts sharing a project slug stay apart. */
export const rollbarNamespace = (account, project) => `rollbar-project:${encodeURIComponent(account)}:${encodeURIComponent(project)}`;
function projectOf(bytes) {
  let bundle;
  try { bundle = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('Export bundle is not JSON'); }
  const account = bundle?.account?.slug, project = bundle?.project?.slug;
  if (bundle?.format !== 'spool-rollbar-project-export' || typeof account !== 'string' || !account || typeof project !== 'string' || !project) throw new Error('Export bundle names no Rollbar account and project slug');
  return { account, project };
}
/** Spool's owner-session client for a Rollbar project, through the same import door as the Sentry importer. */
export function rollbarDoorClient({ endpoint, cookie, account, project, transport }) {
  const make = (accountSlug, projectSlug) => sentryDoorClient({ endpoint, cookie, transport, namespace: rollbarNamespace(accountSlug, projectSlug), organization: projectSlug });
  let client = account && project ? make(account, project) : null;
  return {
    get account() { return account; },
    get project() { return project; },
    async plan(bytes, options) { if (!account || !project) ({ account, project } = projectOf(bytes)); client = make(account, project); return { account, project, ...await client.plan(bytes, options) }; },
    apply: (...args) => client.apply(...args), status: (...args) => client.status(...args), reconcile: (...args) => client.reconcile(...args), undo: (...args) => client.undo(...args),
    call: (...args) => client.call(...args),
    /** Reads the owner's imported project and compares it with the export: counts, stacks, deploys and rules. */
    async compare(bytes, planId) {
      const origin = new URL(endpoint).origin, read = async path => {
        const response = await fetch(origin + path, { redirect: 'error', headers: { Origin: origin, Cookie: cookie } });
        if (!response.ok) throw new Error(`Spool read refused (HTTP ${response.status})`);
        return response.json();
      };
      const report = await client.reconcile(planId), retained = (await client.status(planId)).recordCounts?.byKind ?? {}, [projectId] = report.projectIds ?? [];
      if (!projectId) throw new Error('The import has no native project to compare');
      const issues = await read(`/api/projects/${projectId}/issues`), packets = {};
      for (const issue of issues) packets[issue.id] = await read(`/api/projects/${projectId}/issues/${issue.id}/packet`);
      const releases = await read(`/api/projects/${projectId}/releases`), alertRules = await read(`/api/projects/${projectId}/alerting/rules`);
      return { reconciled: report.ok, ...compareRollbarExport(bytes, { issues, packets, releases: Array.isArray(releases) ? releases : releases.releases ?? [], alertRules, retained }) };
    },
  };
}

export async function rollbarImportCli(args) {
  const [action, ...rest] = args, options = {};
  const verbs = ['dry-run', 'apply', 'status', 'reconcile', 'undo', 'compare'];
  if (!verbs.includes(action)) throw new Error(`Expected ${verbs.join(', ')}`);
  const names = new Map([['--endpoint', 'endpoint'], ['--session-env', 'sessionEnv'], ['--file', 'file'], ['--account', 'account'], ['--project', 'project'], ['--fingerprint', 'fingerprint'], ['--plan', 'plan']]);
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
  const readExport = async () => {
    if (!options.file) throw new Error('file is required');
    const bytes = await readFile(options.file); if (bytes.length > 2 * 1024 * 1024) throw new Error('Export bundle exceeds 2 MiB');
    return bytes;
  };
  if (action === 'dry-run') return rollbarDoorClient({ endpoint: endpoint.origin, cookie }).plan(await readExport(), { catchup: options.catchup });
  if (!options.account) throw new Error('account is required');
  if (!options.project) throw new Error('project is required');
  if (!options.plan) throw new Error('plan is required');
  const client = rollbarDoorClient({ endpoint: endpoint.origin, cookie, account: options.account, project: options.project });
  if (action === 'apply') {
    if (!/^[a-f0-9]{64}$/.test(options.fingerprint ?? '')) throw new Error('The reviewed fingerprint is required');
    return client.apply(options.plan, options.fingerprint);
  }
  if (action === 'compare') return client.compare(await readExport(), options.plan);
  return client[action](options.plan);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) rollbarImportCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
