// The owner's GitHub App connection, from the GITHUB_CONNECTION secret:
// {"appId":"…","installationId":"…","privateKey":"-----BEGIN … KEY-----…"}.
// Without it a fix workflow stops at "approved, awaiting connection".
export type Connection =
 | { state: 'not_configured' }
 | { state: 'invalid'; reason: string }
 | { state: 'configured'; appId: string; installationId: string; apiOrigin: string; privateKey: string; demo?: boolean };

export function connection(env: { GITHUB_CONNECTION?: string; AUTH_LOCAL?: string; RER_DEMO?: string }): Connection {
 if (env.RER_DEMO === '1') return { state: 'configured', appId: 'demo', installationId: 'demo', apiOrigin: 'https://api.github.com', privateKey: '', demo: true };
 if (!env.GITHUB_CONNECTION?.trim()) return { state: 'not_configured' };
 let value: any;
 try { value = JSON.parse(env.GITHUB_CONNECTION); } catch { return { state: 'invalid', reason: 'GITHUB_CONNECTION is not JSON' }; }
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['appId', 'installationId', 'privateKey', 'apiOrigin'].includes(key))) return { state: 'invalid', reason: 'GITHUB_CONNECTION must be an object with known fields' };
 const id = (field: string) => typeof value[field] === 'string' || typeof value[field] === 'number' ? String(value[field]) : '';
 if (!/^\d{1,20}$/.test(id('appId')) || !/^\d{1,20}$/.test(id('installationId'))) return { state: 'invalid', reason: 'appId and installationId must be numeric' };
 if (typeof value.privateKey !== 'string' || !/-----BEGIN (RSA )?PRIVATE KEY-----/.test(value.privateKey)) return { state: 'invalid', reason: 'privateKey must be a PEM private key' };
 let apiOrigin = 'https://api.github.com';
 if (value.apiOrigin !== undefined) {
  // Only a local installation may point at a loopback double of the API.
  let url: URL;
  if (typeof value.apiOrigin !== 'string') return { state: 'invalid', reason: 'apiOrigin must be a URL' };
  try { url = new URL(value.apiOrigin); } catch { return { state: 'invalid', reason: 'apiOrigin must be a URL' }; }
  const loopback = env.AUTH_LOCAL === 'true' && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !loopback) || url.origin !== value.apiOrigin.replace(/\/$/, '')) return { state: 'invalid', reason: 'apiOrigin must be an https origin' };
  apiOrigin = url.origin;
 }
 return { state: 'configured', appId: id('appId'), installationId: id('installationId'), apiOrigin, privateKey: value.privateKey };
}
export const publicConnection = (c: Connection) => c.state === 'configured' ? { state: c.state, appId: c.appId, installationId: c.installationId, api: c.apiOrigin, ...(c.demo ? { demo: true } : {}) } : c;

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (value: string) => base64url(new TextEncoder().encode(value));
function der(tag: number, body: Uint8Array) {
 const length = body.length < 128 ? [body.length] : body.length < 256 ? [0x81, body.length] : [0x82, body.length >> 8, body.length & 255];
 return new Uint8Array([tag, ...length, ...body]);
}
// GitHub issues PKCS#1 keys; WebCrypto imports PKCS#8, so wrap them.
function pkcs8(pem: string) {
 const bytes = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), char => char.charCodeAt(0));
 if (!pem.includes('BEGIN RSA PRIVATE KEY')) return bytes;
 const algorithm = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
 return der(0x30, new Uint8Array([0x02, 0x01, 0x00, ...algorithm, ...der(0x04, bytes)]));
}
// The App's short-lived JWT authenticates installation lookup or token minting.
export async function appJwt(c: Extract<Connection, { state: 'configured' }>, now = Date.now()) {
 const key = await crypto.subtle.importKey('pkcs8', pkcs8(c.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
 const seconds = Math.floor(now / 1000), body = `${text(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${text(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: c.appId }))}`;
 return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))))}`;
}

export async function checkConnection(connection: Connection): Promise<{ ok: true } | { ok: false; message: string }> {
 if (connection.state !== 'configured' || connection.demo) return { ok: false, message: 'An installation operator must configure the GitHub connection first.' };
 let jwt: string;
 try { jwt = await appJwt(connection); }
 catch { return { ok: false, message: 'Spool could not use the private key. Ask the installation operator to check the GitHub App PEM.' }; }
 try {
  const response = await fetch(`${connection.apiOrigin}/app/installations/${connection.installationId}`, {
   headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jwt}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'spool-fix-workflow' },
   redirect: 'manual',
   signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
   await response.body?.cancel();
   if ([401, 403, 404].includes(response.status)) return { ok: false, message: 'GitHub refused access to this App installation. Check the App ID, installation ID and private key.' };
   return { ok: false, message: 'GitHub could not check the installation. Try again.' };
  }
  const installation = await response.json() as { id?: number; app_id?: number; suspended_at?: string | null } | null;
  if (String(installation?.id) !== connection.installationId || String(installation?.app_id) !== connection.appId) return { ok: false, message: 'GitHub did not confirm the configured App installation. Check the App ID and installation ID.' };
  if (installation?.suspended_at) return { ok: false, message: 'GitHub has suspended this App installation. Ask the repository administrator to review it.' };
  return { ok: true };
 } catch {
  return { ok: false, message: 'Spool could not check the installation with GitHub. Try again.' };
 }
}
