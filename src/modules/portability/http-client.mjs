import { readArchive } from './format.mjs';
import { portabilityErrorCode } from './storage.mjs';

const jobPattern = /^[a-zA-Z0-9-]{1,100}$/;
const stages = new Set(['create', 'status', 'advance', 'download', 'parts', 'finalize', 'abort']);
const publicValue = (value, cookie) => ![cookie, cookie.slice(cookie.indexOf('=') + 1)].filter(Boolean).some(secret => value.includes(secret));
const jobId = (value, cookie) => typeof value === 'string' && jobPattern.test(value) && !value.includes('\n') && publicValue(value, cookie) ? value : undefined;

// The runner and a seed adapter can import independent maintained copies. Share
// identity approval within their realm, exposing only the bounded constructor
// and lookup, never the map or a way to approve an arbitrary Error/message.
const diagnosticKey = Symbol.for('runeditrun.portability.diagnostics.v1');
if (!Object.hasOwn(globalThis, diagnosticKey)) Object.defineProperty(globalThis, diagnosticKey, { value: createDiagnostics() });
const diagnostics = globalThis[diagnosticKey];
export const transferDiagnostic = error => diagnostics.get(error);
function createDiagnostics() {
  const approved = new WeakMap();
  function failure(path, status, body, cookie) {
    const [collection, id, action] = path.split('/');
    const operation = collection === 'exports' ? 'export' : 'import';
    const step = stages.has(action) ? action : id ? 'status' : 'create';
    const details = [];
    if (jobId(id, cookie)) details.push('job ' + id);
    if (Number.isInteger(status) && status >= 100 && status <= 599) details.push('HTTP ' + status);
    const raw = body?.code ?? body?.error?.code ?? body?.error;
    // Portability codes may append table, key or row details after a colon.
    // Retain only the bounded machine identifier, never those private details.
    const code = typeof raw === 'string' && publicValue(raw, cookie) ? raw.split(':', 1)[0] : undefined;
    if (code && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(code) && !code.includes('\n') && publicValue(code, cookie)) details.push('code ' + code);
    else if (Number.isSafeInteger(raw) && raw >= 0 && publicValue(String(raw), cookie)) details.push('code ' + raw);
    const message = `Hosted ${operation} ${step} failed${details.length ? ' (' + details.join('; ') + ')' : ''}.`;
    const error = new Error(message);
    approved.set(error, message);
    return error;
  }
  return Object.freeze({ failure, get: error => approved.get(error) });
}

export function transferClient({ endpoint, origin, cookie }) {
  const responses = new WeakMap();
  const failure = (path, status, body) => diagnostics.failure(path, status, body, cookie);
  async function request(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch(endpoint + '/' + path, { method, redirect: 'error',
        headers: { Cookie: cookie, Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw failure(path); }
    if (!response.ok) throw failure(path, response.status, await errorBody(response));
    return response;
  }
  return {
    async download(id) {
      const path = 'exports/' + id + '/download', response = await request(path);
      // Consumption and verification happen after the HTTP request succeeds.
      // Preserve that response's context without trusting a stream's Error.
      return (async function* () {
        try { yield* readArchive(response.body); }
        catch (error) { throw failure(path, response.status, { code: portabilityErrorCode(error) }); }
      })();
    },
    async get(...args) {
      const response = await request(...args);
      let body;
      try { body = await response.json(); } catch { throw failure(args[0], response.status); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(args[0], response.status);
      responses.set(body, response.status);
      return body;
    },
    jobId(value, collection) {
      if (!jobId(value, cookie)) throw failure(collection);
      return value;
    },
    failedJob(path, body) { return failure(path, responses.get(body), body); },
  };
}

// Error responses can be arbitrary provider HTML or huge private diagnostics.
// Read a bounded JSON envelope solely to recover its machine code.
async function errorBody(response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  try {
    let size = 0; const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) return;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { return; }
  finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
}
