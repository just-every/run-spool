export async function ownerFetch(path: string, options?: RequestInit) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  if (response.status === 401) {
    window.dispatchEvent(new Event('spool:auth-lost'));
    window.dispatchEvent(new Event('spool-session-expired'));
  }
  return response;
}
export async function api(path: string, method = 'GET', value?: unknown) {
  const response = await ownerFetch(path, { method, headers: value ? { 'Content-Type': 'application/json' } : {}, ...(value ? { body: JSON.stringify(value) } : {}) });
  const result: any = await response.json();
  if (!response.ok) { const error = new Error(result.error ?? result.reason ?? `Request failed (${response.status})`) as Error & { status: number }; error.status = response.status; throw error; }
  return result;
}
