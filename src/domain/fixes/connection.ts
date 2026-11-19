type Source = 'saved' | 'environment';
export type Connection =
 | { state: 'not_configured' }
 | { state: 'invalid'; reason: string; source: Source }
 | { state: 'configured'; appId: string; installationId: string; apiOrigin: string; privateKey: string; source?: Source; demo?: boolean };

export function environmentConnection(env: { GITHUB_CONNECTION?: string; AUTH_LOCAL?: string; RER_DEMO?: string }): Connection {
 if (env.RER_DEMO === '1') return { state: 'configured', appId: 'demo', installationId: 'demo', apiOrigin: 'https://api.github.com', privateKey: '', demo: true };
 if (!env.GITHUB_CONNECTION?.trim()) return { state: 'not_configured' };
 let value: any;
 try { value = JSON.parse(env.GITHUB_CONNECTION); } catch { return { state: 'invalid', source: 'environment', reason: 'GITHUB_CONNECTION is not JSON' }; }
 return parseConnection(value, 'environment', env.AUTH_LOCAL === 'true');
}

export function parseConnection(value: any, source: Source, local = false): Exclude<Connection,{state:'not_configured'}> {
 const invalid = (reason: string): Extract<Connection,{state:'invalid'}> => ({state: 'invalid', source, reason});
 const fields = ['appId', 'installationId', 'privateKey'];
 if (source === 'environment') fields.push('apiOrigin');
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) return invalid('Use the App ID, installation ID and private key.');
 const id = (field: string) => typeof value[field] === 'string' || Number.isSafeInteger(value[field]) ? String(value[field]) : '';
 const numeric = source === 'saved' ? /^[1-9]\d{0,19}$/ : /^\d{1,20}$/;
 if (!numeric.test(id('appId')) || !numeric.test(id('installationId'))) return invalid('Enter the numeric App ID and installation ID from GitHub.');
 if (typeof value.privateKey !== 'string' || !/-----BEGIN (RSA )?PRIVATE KEY-----/.test(value.privateKey)) return invalid('privateKey must be a PEM private key');
 let apiOrigin = 'https://api.github.com';
 if (value.apiOrigin !== undefined) {
  // Only a local installation may point at a loopback double of the API.
  let url: URL;
  try { if (typeof value.apiOrigin !== 'string') throw new Error(); url = new URL(value.apiOrigin); } catch { return invalid('apiOrigin is not a URL'); }
  const loopback = local && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !loopback) || url.origin !== value.apiOrigin.replace(/\/$/, '')) return invalid('apiOrigin must be an https origin');
  apiOrigin = url.origin;
 }
 return { state: 'configured', source, appId: id('appId'), installationId: id('installationId'), apiOrigin, privateKey: value.privateKey };
}
export const publicConnection = (c: Connection) => c.state === 'configured' ? { state: c.state, appId: c.appId, installationId: c.installationId, api: c.apiOrigin, ...(c.source ? { source: c.source } : {}), ...(c.demo ? { demo: true } : {}) } : c;

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
export function signingKey(pem: string) {
 return crypto.subtle.importKey('pkcs8', pkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
// The App JWT authenticates the selected installation read and grant-scoped token mint.
export async function appJwt(c: Extract<Connection, { state: 'configured' }>, now = Date.now()) {
 const key = await signingKey(c.privateKey);
 const seconds = Math.floor(now / 1000), body = `${text(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${text(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: c.appId }))}`;
 return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))))}`;
}
