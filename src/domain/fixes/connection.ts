// The owner's GitHub App connection, from the GITHUB_CONNECTION secret:
// {"appId":"…","installationId":"…","privateKey":"-----BEGIN … KEY-----…"}.
// Without it a fix workflow stops at "approved, awaiting connection".
export type Connection =
 | { state: 'not_configured' }
 | { state: 'invalid'; reason: string }
 | { state: 'configured'; appId: string; installationId: string; apiOrigin: string; privateKey: string };

export function connection(env: { GITHUB_CONNECTION?: string; AUTH_LOCAL?: string }): Connection {
 if (!env.GITHUB_CONNECTION?.trim()) return { state: 'not_configured' };
 let value: any;
 try { value = JSON.parse(env.GITHUB_CONNECTION); } catch { return { state: 'invalid', reason: 'GITHUB_CONNECTION is not JSON' }; }
 if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['appId', 'installationId', 'privateKey', 'apiOrigin'].includes(key))) return { state: 'invalid', reason: 'GITHUB_CONNECTION has unknown fields' };
 const id = (field: string) => typeof value[field] === 'string' || typeof value[field] === 'number' ? String(value[field]) : '';
 if (!/^\d{1,20}$/.test(id('appId')) || !/^\d{1,20}$/.test(id('installationId'))) return { state: 'invalid', reason: 'appId and installationId must be numeric' };
 if (typeof value.privateKey !== 'string' || !/-----BEGIN (RSA )?PRIVATE KEY-----/.test(value.privateKey)) return { state: 'invalid', reason: 'privateKey must be a PEM private key' };
 let apiOrigin = 'https://api.github.com';
 if (value.apiOrigin !== undefined) {
  // Only a local installation may point at a loopback double of the API.
  let url: URL;
  try { url = new URL(value.apiOrigin); } catch { return { state: 'invalid', reason: 'apiOrigin is not a URL' }; }
  const loopback = env.AUTH_LOCAL === 'true' && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !loopback) || url.origin !== value.apiOrigin.replace(/\/$/, '')) return { state: 'invalid', reason: 'apiOrigin must be an https origin' };
  apiOrigin = url.origin;
 }
 return { state: 'configured', appId: id('appId'), installationId: id('installationId'), apiOrigin, privateKey: value.privateKey };
}
export const publicConnection = (c: Connection) => c.state === 'configured' ? { state: c.state, appId: c.appId, installationId: c.installationId, api: c.apiOrigin } : c;

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
// The App's short-lived JWT, used only to mint one installation token.
export async function appJwt(c: Extract<Connection, { state: 'configured' }>, now = Date.now()) {
 const key = await crypto.subtle.importKey('pkcs8', pkcs8(c.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
 const seconds = Math.floor(now / 1000), body = `${text(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${text(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: c.appId }))}`;
 return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))))}`;
}
