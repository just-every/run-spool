import type { Bindings } from '../../auth/bindings';
import { hash } from '../privacy';
import { mintAdmission } from '../dev-credentials';
import { projectDsn } from '../sentry/dsn';
import { installLoader } from './client';
import { readLoader } from './options';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
export async function loaderResponse(request: Request, env: Bindings): Promise<Response | null> {
 const path = new URL(request.url).pathname;
 if (path === '/spool-sentry-sdk.js' && ['GET', 'HEAD'].includes(request.method)) {
  const asset = await env.ASSETS?.fetch(request);
  if (!asset || asset.status !== 200) return new Response('Not found', { status: 404, headers });
  return new Response(asset.body, { headers: { ...Object.fromEntries(asset.headers), ...headers } });
 }
 const match = /^\/sdk\/([^/]+)\.min\.js$/.exec(path);
 if (!match) return null;
 const missing = () => new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
 if (!['GET', 'HEAD'].includes(request.method) || !/^[a-f0-9]{64}$/.test(match[1])) return missing();
 const key = match[1], keyHash = await hash(key);
 const row = await env.DB.prepare(`SELECT project FROM credentials WHERE hash=? AND kind='ingest' AND revoked IS NULL AND ${await mintAdmission(request)}`).bind(keyHash).first<{ project: string }>();
 if (!row) return missing();
 const { settings } = await readLoader(env.DB, row.project, keyHash);
 if (!settings.enabled) return missing();
 const config = { dsn: await projectDsn(env.DB, env.AUTH_ORIGIN, row.project, key), bundle: new URL('/spool-sentry-sdk.js', env.AUTH_ORIGIN).href, options: settings };
 return new Response(request.method === 'HEAD' ? null : `;(${installLoader.toString()})(${JSON.stringify(config)});`, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
}
