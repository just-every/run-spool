#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const CHUNK = 65_536, MAX_BYTES = 2 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function projectId(value) {
  const id = String(value ?? '');
  if (!/^[1-9]\d*$/.test(id)) throw new Error('A Rollbar project ID is required');
  return id;
}
export const rollbarNamespace = project => `rollbar-project:${projectId(project)}`;
function projectOf(bytes) {
  let bundle;
  try { bundle = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('Export bundle is not JSON'); }
  if (bundle?.format !== 'spool-rollbar-export' || bundle.version !== 1 || bundle.project?.err !== 0) throw new Error('Expected a Rollbar export v1 bundle with its project response');
  return projectId(bundle.project.result?.id);
}
function endpointOrigin(value) {
  let endpoint;
  try { endpoint = new URL(value); } catch { throw new Error('Endpoint must be an HTTP(S) origin without credentials'); }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/' || !['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Endpoint must be an HTTP(S) origin without credentials');
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Owner session requires HTTPS outside loopback');
  return endpoint.origin;
}
function reviewed(value) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) throw new Error('The reviewed fingerprint is required');
  return value;
}

/** Every request uses the existing owner-session import door. An injected
 * transport(action, body, namespace) must provide its own authenticated request. */
export function rollbarDoorClient({ endpoint, cookie, project, transport }) {
  if (project !== undefined) project = projectId(project);
  if (!transport) {
    const origin = endpointOrigin(endpoint);
    if (typeof cookie !== 'string' || !cookie || /[\r\n]/.test(cookie)) throw new Error('A valid owner session cookie is required');
    transport = (action, body, namespace) => fetch(`${origin}/api/operator/import/${action}`, {
      method: 'POST', redirect: 'error',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-Import-Source': namespace },
      body: JSON.stringify(body),
    });
  }
  async function call(action, body) {
    const namespace = rollbarNamespace(project);
    let response;
    try { response = await transport(action, body, namespace); } catch { throw new Error('Spool import transport failed'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = typeof result.error === 'string' && /^[a-z0-9_:-]+$/.test(result.error) ? result.error : undefined;
      throw Object.assign(new Error(`Spool import refused (HTTP ${response.status}${code ? `: ${code}` : ''})`), { status: response.status, code });
    }
    return { ...result, project, namespace };
  }
  async function until(action, body, state, once = false) {
    for (let batch = 0; batch < 100; batch++) {
      const result = await call(action, body);
      if (result.job?.state === state) return result;
      if (!['queued', 'applying', 'undoing'].includes(result.job?.state)) throw new Error(`Import ${action} stopped in an unexpected state`);
      if (once) return result;
    }
    throw new Error(`Import ${action} did not finish within 100 bounded requests; inspect status and resume`);
  }
  return {
    call,
    async upload(input, name = 'rollbar-project.json') {
      const bytes = Buffer.from(input);
      if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Export bundle must contain at most 2 MiB');
      const sourceProject = projectOf(bytes);
      if (project !== undefined && project !== sourceProject) throw new Error('Export bundle names a different Rollbar project');
      project = sourceProject;
      const bundleSha256 = sha256(bytes), totalChunks = Math.ceil(bytes.length / CHUNK);
      let uploadId;
      for (let index = 0; index < totalChunks; index++) {
        const chunk = bytes.subarray(index * CHUNK, (index + 1) * CHUNK);
        const uploaded = await call('uploads', { ...(uploadId ? { uploadId } : {}), name, bundleSha256, totalBytes: bytes.length, totalChunks, index,
          chunkSha256: sha256(chunk), base64: chunk.toString('base64') });
        if (typeof uploaded.uploadId !== 'string' || !uploaded.uploadId || (uploadId && uploaded.uploadId !== uploadId)) throw new Error('Upload returned an inconsistent ID');
        uploadId = uploaded.uploadId;
      }
      const inventory = await call('uploads', { uploadId });
      if (!inventory.complete || inventory.bundleSha256 !== bundleSha256) throw new Error('Upload incomplete');
      return inventory;
    },
    async plan(bytes) {
      const { uploadId } = await this.upload(bytes);
      return { uploadId, ...await call('plan', { uploadId }) };
    },
    apply: (planId, fingerprint, { once = false } = {}) => until('apply', { planId, reviewedFingerprint: reviewed(fingerprint) }, 'completed', once),
    resume: (planId, fingerprint) => until('apply', { planId, reviewedFingerprint: reviewed(fingerprint) }, 'completed'),
    status: planId => call('status', { planId }),
    reconcile: planId => call('reconcile', { planId }),
    undo: planId => until('undo', { planId }, 'undone'),
    async originals(planId) {
      const origin=endpointOrigin(endpoint);
      const response=await fetch(`${origin}/api/imports/rollbar/${encodeURIComponent(project)}/${encodeURIComponent(planId)}/originals`,{redirect:'error',headers:{Cookie:cookie}});
      if(!response.ok)throw Object.assign(new Error(`Spool originals refused (HTTP ${response.status})`),{status:response.status});
      return response.json();
    },
    get project() { return project; },
  };
}

export async function rollbarImportCli(args) {
  const [action, ...rest] = args, options = {};
  const verbs = ['dry-run', 'apply', 'resume', 'status', 'reconcile', 'undo', 'originals'];
  if (!verbs.includes(action)) throw new Error(`Expected ${verbs.join(', ')}`);
  const allowed = new Set(['endpoint', 'session-env', 'project', ...(action === 'dry-run' ? ['file'] : ['plan']),
    ...(['apply', 'resume'].includes(action) ? ['fingerprint'] : []), ...(action === 'apply' ? ['once'] : []), ...(action === 'originals' ? ['output'] : [])]);
  for (let index = 0; index < rest.length; index++) {
    const name = rest[index].startsWith('--') ? rest[index].slice(2) : '';
    if (!allowed.has(name) || Object.hasOwn(options, name)) throw new Error('Invalid or duplicate option');
    if (name === 'once') { options.once = true; continue; }
    if (!rest[index + 1] || rest[index + 1].startsWith('--')) throw new Error('Option requires a value');
    options[name] = rest[++index];
  }
  const endpoint = endpointOrigin(options.endpoint);
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(options['session-env'] ?? '') || !process.env[options['session-env']]) throw new Error('session-env must name a populated owner session environment variable');
  const cookie = process.env[options['session-env']];
  if (/[\r\n]/.test(cookie)) throw new Error('A valid owner session cookie is required');
  if (action === 'dry-run') {
    if (!options.file) throw new Error('file is required');
    const bytes = await readFile(options.file);
    return rollbarDoorClient({ endpoint, cookie, project: options.project }).plan(bytes);
  }
  const project = projectId(options.project);
  if (!options.plan) throw new Error('plan is required');
  const client = rollbarDoorClient({ endpoint, cookie, project });
  if(action==='originals'){
    if(!options.output)throw new Error('Originals require --output FILE');
    const original=await client.originals(options.plan);
    await writeFile(options.output,JSON.stringify(original),{mode:0o600,flag:'wx'});
    return {saved:true};
  }
  if (action === 'apply') return client.apply(options.plan, options.fingerprint, { once: options.once });
  if (action === 'resume') return client.resume(options.plan, options.fingerprint);
  return client[action](options.plan);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rollbarImportCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
