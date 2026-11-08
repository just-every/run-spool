import { createHash } from 'node:crypto';

const CHUNK = 65_536;
export const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Keep owner cookies at the exact app origin; never follow redirects. */
export function importConnection(options) {
  let endpoint;
  try { endpoint = new URL(options.endpoint); } catch { throw new Error('Endpoint must be an HTTP(S) origin without credentials'); }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/' || !['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Endpoint must be an HTTP(S) origin without credentials');
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Owner session requires HTTPS outside loopback');
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(options.sessionEnv ?? '') || !process.env[options.sessionEnv]) throw new Error('session-env must name a populated owner session environment variable');
  return { endpoint: endpoint.origin, cookie: process.env[options.sessionEnv] };
}

/** Shared owner-session transport. Vendor adapters supply identity extraction;
 * uploaded bytes are never translated into another vendor's export format. */
export function importDoorClient({ endpoint, cookie, organization, transport, namespaceOf, organizationOf, uploadName }) {
  transport ??= (action, body, namespace) => {
    const origin = new URL(endpoint).origin;
    return fetch(`${origin}/api/operator/import/${action}`, { method: 'POST', redirect: 'error',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-Import-Source': namespace }, body: JSON.stringify(body) });
  };
  async function call(action, body, namespace = namespaceOf(organization)) {
    let response;
    try { response = await transport(action, body, namespace); } catch { throw new Error('Spool import transport failed'); }
    const result = await response.json().catch(() => ({}));
    // A remote body is not a safe diagnostic: expose only bounded error codes.
    const code = typeof result?.error === 'string' && /^[a-z0-9_]{1,80}$/i.test(result.error) ? result.error : undefined;
    if (!response.ok) throw Object.assign(new Error(`Spool import refused (HTTP ${response.status}${code ? `: ${code}` : ''})`), { status: response.status, code });
    return result;
  }
  async function until(action, body, state) {
    for (let batch = 0; batch < 100; batch++) {
      const result = await call(action, body);
      if (result.job?.state === state) return result;
      if (!['queued', 'applying', 'undoing'].includes(result.job?.state)) throw new Error(`Import ${action} stopped before completion; inspect authenticated status`);
    }
    throw new Error(`Import ${action} did not finish within 100 bounded requests`);
  }
  return {
    call,
    async upload(bytes, name = uploadName) {
      if (!bytes.length) throw new Error('Export bundle is empty');
      if (bytes.length > MAX_BUNDLE_BYTES) throw new Error('Export bundle exceeds 2 MiB');
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
    async plan(bytes, { catchup } = {}) {
      const { uploadId } = await this.upload(bytes);
      return { organization, namespace: namespaceOf(organization), uploadId, ...await call('plan', { uploadId, ...catchup ? { catchup: true } : {} }) };
    },
    apply: (planId, reviewedFingerprint) => until('apply', { planId, reviewedFingerprint }, 'completed'),
    status: planId => call('status', { planId }),
    reconcile: planId => call('reconcile', { planId }),
    undo: planId => until('undo', { planId }, 'undone'),
    get organization() { return organization; },
  };
}
