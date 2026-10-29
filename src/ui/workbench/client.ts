let sessionRevision = 0;

export async function ownerFetch(path: string, options?: RequestInit) {
  let response: Response;
  try { response = await fetch(path, { credentials: 'same-origin', ...options }); }
  catch { throw new Error(navigator.onLine ? 'Spool is unavailable. Check your connection and try again.' : 'You are offline. Reconnect and try again.'); }
  if (response.status === 401) {
    sessionRevision++;
    pending.clear();
    window.dispatchEvent(new Event('spool:auth-lost'));
    window.dispatchEvent(new Event('spool-session-expired'));
  }
  return response;
}
async function read(path: string, method = 'GET', value?: unknown) {
  const started = sessionRevision;
  const response = await ownerFetch(path, { method, headers: value ? { 'Content-Type': 'application/json' } : {}, ...(value ? { body: JSON.stringify(value) } : {}) });
  if (started !== sessionRevision && response.ok) throw Object.assign(new Error('Session ended.'), { status: 401 });
  if (response.status >= 500) throw Object.assign(new Error('Spool is unavailable. Try again.'), { status: response.status });
  const result: any = await response.json();
  if (!response.ok) { const error = new Error(result.error ?? result.reason ?? `Request failed (${response.status})`) as Error & { status: number }; error.status = response.status; throw error; }
  return result;
}

const pending = new Map<string, Promise<any>>();
export function api(path: string, method = 'GET', value?: unknown): Promise<any> {
  if (method !== 'GET') {
    // Refreshes after a write must never join reads from before that write.
    pending.clear();
    return read(path, method, value).finally(() => pending.clear());
  }
  const active = pending.get(path);
  if (active) return active;
  const request = read(path, method, value).finally(() => { if (pending.get(path) === request) pending.delete(path); });
  pending.set(path, request);
  return request;
}
