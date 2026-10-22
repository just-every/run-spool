// The Sentry browser SDK's standard `tunnel` option, through the tunnels Spool ships (@just-every/spool/tunnel and
// /next for Node and Next.js, spool_tunnel.py for Python), with the EasyPrivacy Sentry rules enforced in the browser.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { FiltersEngine, Request as AdRequest } from '@ghostery/adblocker';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';

const require = createRequire(import.meta.url), wait = ms => new Promise(done => setTimeout(done, ms));
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-tunnel-')), app = resolve(temporary, 'app'), site = resolve(temporary, 'site');
let worker, browser, python, nodeServer, capture, nextServer;
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(server.address().port)));
try {
  await mkdir(app); await mkdir(site);
  const packed = JSON.parse(execFileSync(process.execPath, ['packages/sdk/build.mjs', '--pack'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  await writeFile(resolve(app, 'package.json'), JSON.stringify({ name: 'fresh-app', private: true, type: 'module' }));
  execFileSync('npm', ['install', packed.tarball, '--offline', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: app, stdio: 'ignore' });
  const sdk = name => import(pathToFileURL(resolve(app, 'node_modules/@just-every/spool/dist', name)).href);
  const { nodeTunnel } = await sdk('tunnel.js');

  worker = await startTestWorker(15571); const { origin } = worker, cookie = await signIn(origin);
  const request = async (path, method = 'GET', body) => { const response = await fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`); return response.json(); };
  const project = await request('/api/projects', 'POST', { id: 'tunnel', name: 'Tunnelled browser' }), other = await request('/api/projects', 'POST', { id: 'tunnel-other', name: 'Another project' });

  // A recording upstream stands in for Spool only to read exactly what the tunnels forward (a network-edge fake).
  const seen = [];
  capture = createServer(async (req, res) => { const chunks = []; for await (const chunk of req) chunks.push(chunk); seen.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) }); res.setHeader('x-sentry-rate-limits', '60:replay'); res.statusCode = 200; res.end('{}'); });
  const capturePort = await listen(capture), captureDsn = `http://synthetic-spool-1@127.0.0.1:${capturePort}/9`;

  // One real browser SDK program; only the DSN and the `tunnel` option differ between pages.
  await writeFile(resolve(app, 'page.js'), `import * as Sentry from '@sentry/browser';\nSentry.init({dsn:globalThis.__DSN__,tunnel:globalThis.__TUNNEL__,release:'tunnel@1.0.0',environment:'tunnel'});\nwindow.report=message=>{Sentry.captureException(new Error(message));return Sentry.flush(5000)};\n`);
  await build({ entryPoints: [resolve(app, 'page.js')], outfile: resolve(site, 'page.js'), bundle: true, minify: true, format: 'esm', platform: 'browser', nodePaths: [resolve('node_modules')] });
  const html = (dsn, tunnel) => `<!doctype html><title>Tunnel page</title><script>globalThis.__DSN__=${JSON.stringify(dsn)};globalThis.__TUNNEL__=${tunnel ? JSON.stringify(tunnel) : 'undefined'}</script><script type="module" src="/page.js"></script>`;
  await writeFile(resolve(site, 'direct.html'), html(project.dsn));
  await writeFile(resolve(site, 'tunnel.html'), html(project.dsn, '/monitoring'));

  // Node (Express-style) server with the tunnel at /monitoring.
  const tunnelNode = nodeTunnel({ dsn: [project.dsn, captureDsn] });
  nodeServer = createServer(async (req, res) => {
    if (req.url === '/monitoring') return tunnelNode(req, res);
    try { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(await readFile(resolve(site, req.url.slice(1)))); } catch { res.statusCode = 404; res.end(); }
  });
  const nodeOrigin = `http://127.0.0.1:${await listen(nodeServer)}`;
  const pythonPort = 20000 + Math.floor(Math.random() * 20000), pythonOrigin = `http://127.0.0.1:${pythonPort}`;
  python = spawn('python3', ['tests/tunnel/server.py', String(pythonPort), site, project.dsn, captureDsn], { stdio: ['ignore', 'pipe', 'inherit'] });
  process.once('exit', () => python.kill());
  await new Promise((done, fail) => { python.once('error', fail); python.stdout.once('data', done); });

  // The standard ad-blocker engine with the real EasyPrivacy Sentry rules, enforced on every browser request.
  const engine = FiltersEngine.parse(await readFile('tests/fixtures/adblock/easyprivacy-sentry.txt', 'utf8'));
  const blocked = [];
  const newPage = async () => {
    const context = await browser.newContext(), page = await context.newPage();
    await context.route('**/*', route => { const r = route.request(), url = r.url(); const verdict = engine.match(AdRequest.fromRawDetails({ url, sourceUrl: page.url() || nodeOrigin, type: r.resourceType() === 'fetch' ? 'xmlhttprequest' : r.resourceType() })); if (verdict.match) { blocked.push(url); return route.abort('blockedbyclient'); } return route.continue(); });
    return page;
  };
  const issues = () => request('/api/projects/tunnel/issues');
  const countOccurrences = async () => (await issues()).reduce((n, i) => n + i.count, 0);
  const throwOnce = async (pageUrl, message) => { const page = await newPage(); await page.goto(pageUrl); await page.waitForFunction(() => window.report); const flushed = await page.evaluate(m => window.report(m), message); await page.context().close(); return flushed; };
  const arrives = async (message, expected) => { for (let attempt = 0; attempt < (expected === false ? 30 : 300); attempt++) { const rows = await issues(); if (rows.some(i => i.title.includes(message))) return true; await wait(100); } return expected === false ? false : assert.fail(`${message} never arrived`); };
  browser = await launchBrowser();

  // 1. The default ingest request is exactly what the list blocks: nothing arrives without a tunnel.
  await request('/api/projects/tunnel/browser-origins', 'POST', { origin: nodeOrigin });
  await throwOnce(`${nodeOrigin}/direct.html`, 'blocked direct capture');
  await wait(800);
  assert.ok(blocked.some(url => url.includes('/envelope/?sentry_')), 'the list blocks the SDK’s ingest request '+JSON.stringify(blocked));
  assert.equal(await countOccurrences(), 0, 'no browser error reaches Spool through the blocked default route');

  // 2. The Node tunnel carries the same SDK's envelope past the list, and Spool still enforces its allowed origins.
  await throwOnce(`${nodeOrigin}/tunnel.html`, 'tunnelled by node');
  await arrives('tunnelled by node');
  const nodeIssue = (await issues()).find(i => i.title.includes('tunnelled by node')), packet = await request(`/api/projects/tunnel/issues/${nodeIssue.id}/packet`);
  assert.equal(packet.events[0].event.release, 'tunnel@1.0.0');

  // 3. The Python tunnel: refused while its page origin is not allowed, then accepted once it is.
  await throwOnce(`${pythonOrigin}/tunnel.html`, 'tunnelled by python before allowed');
  assert.equal(await arrives('tunnelled by python before allowed', false), false, 'an origin the project does not allow is still refused through a tunnel');
  await request('/api/projects/tunnel/browser-origins', 'POST', { origin: pythonOrigin });
  await throwOnce(`${pythonOrigin}/tunnel.html`, 'tunnelled by python');
  await arrives('tunnelled by python');

  // 4. A fresh Next.js app. Sentry's own `tunnelRoute` rewrite can only name Sentry's hosted ingest; the Spool route handler
  // and the SDK's standard `tunnel` option replace it. Real `next build` and `next start`, with Sentry's SDK in the page.
  const nextDir = resolve(temporary, 'next-app'), nextVersion = { next: '16.4.2', react: '19.2.8', 'react-dom': '19.2.8', '@sentry/nextjs': '11.8.0' };
  await mkdir(resolve(nextDir, 'app/monitoring'), { recursive: true });
  await writeFile(resolve(nextDir, 'package.json'), JSON.stringify({ name: 'fresh-next', private: true, type: 'module', dependencies: nextVersion }));
  execFileSync('npm', ['install', '--no-audit', '--no-fund', packed.tarball], { cwd: nextDir, stdio: 'ignore' });
  await writeFile(resolve(nextDir, 'app/layout.js'), "export default function Layout({ children }) { return <html lang=\"en\"><body>{children}</body></html>; }\n");
  await writeFile(resolve(nextDir, 'app/page.js'), "'use client';\nexport default function Page() { return <button onClick={() => { throw new Error('next checkout failure'); }}>Throw</button>; }\n");
  const nextEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SPOOL_DSN: project.dsn, SPOOL_TUNNEL_DSNS: `${project.dsn} ${captureDsn}` };
  const nextBin = resolve(nextDir, 'node_modules/next/dist/bin/next');
  const nextBuild = () => execFileSync(process.execPath, [nextBin, 'build'], { cwd: nextDir, env: nextEnv, stdio: 'pipe' });
  // 4a. Sentry's tunnelRoute: the generated rewrites only target sentry.io, so it cannot carry events to a Spool DSN.
  await writeFile(resolve(nextDir, 'next.config.mjs'), "import { withSentryConfig } from '@sentry/nextjs/config';\nexport default withSentryConfig({}, { tunnelRoute: '/sentry-tunnel', silent: true, telemetry: false, sourcemaps: { disable: true }, release: { create: false, finalize: false } });\n");
  await writeFile(resolve(nextDir, 'instrumentation-client.js'), "import * as Sentry from '@sentry/nextjs';\nSentry.init({ dsn: process.env.NEXT_PUBLIC_SPOOL_DSN, release: 'next@1.0.0', environment: 'next' });\n");
  nextBuild();
  const rewrites = JSON.parse(await readFile(resolve(nextDir, '.next/routes-manifest.json'), 'utf8')).rewrites.afterFiles;
  assert.ok(rewrites.length > 0 && rewrites.every(rule => new URL(rule.destination.replace(/:(\w+)/g, 'x')).hostname.endsWith('.sentry.io')), 'tunnelRoute only rewrites to Sentry’s hosted ingest');
  // 4b. The Spool route handler plus the standard tunnel option.
  await rm(resolve(nextDir, 'next.config.mjs'));
  await writeFile(resolve(nextDir, 'app/monitoring/route.js'), "import { spoolTunnelRoute } from '@just-every/spool/next';\nexport const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_TUNNEL_DSNS.split(' ') });\n");
  await writeFile(resolve(nextDir, 'instrumentation-client.js'), "import * as Sentry from '@sentry/nextjs';\nSentry.init({ dsn: process.env.NEXT_PUBLIC_SPOOL_DSN, tunnel: '/monitoring', release: 'next@1.0.0', environment: 'next' });\n");
  nextBuild();
  const nextPort = 20000 + Math.floor(Math.random() * 20000), nextOrigin = `http://127.0.0.1:${nextPort}`;
  nextServer = spawn(process.execPath, [nextBin, 'start', '-p', String(nextPort), '-H', '127.0.0.1'], { cwd: nextDir, env: nextEnv, stdio: ['ignore', 'pipe', 'inherit'] });
  process.once('exit', () => nextServer.kill());
  await new Promise((done, fail) => { nextServer.once('error', fail); nextServer.stdout.on('data', chunk => { if (/Ready/.test(String(chunk))) done(); }); });
  await request('/api/projects/tunnel/browser-origins', 'POST', { origin: nextOrigin });
  const nextPage = await newPage(); await nextPage.goto(nextOrigin); await nextPage.waitForLoadState('networkidle'); await nextPage.getByRole('button').click(); await nextPage.context().close();
  await arrives('next checkout failure');

  const envelopeOf = dsn => `${JSON.stringify({ event_id: 'a'.repeat(32), dsn })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify({ event_id: 'a'.repeat(32), release: 'tunnel@1.0.0', exception: { values: [{ type: 'Error', value: 'tunnelled', stacktrace: { frames: [{ filename: 'app.js', lineno: 1, colno: 1, function: 'next' }] } }] } })}`;
  const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { Origin: nodeOrigin, ...headers }, body });

  // 5. A tunnel is not an open relay: another project, a malformed header and a wrong method forward nothing.
  const before = await countOccurrences(), forwardedBefore = seen.length;
  for (const base of [nodeOrigin, pythonOrigin, nextOrigin]) {
    const path = '/monitoring';
    assert.equal((await post(base + path, envelopeOf(other.dsn))).status, 403, `${base} refuses another project’s DSN`);
    assert.equal((await post(base + path, 'not an envelope')).status, 400);
    assert.equal((await fetch(base + path)).status, 405);
  }
  assert.equal(await countOccurrences(), before, 'refused envelopes create nothing');
  assert.equal(seen.length, forwardedBefore, 'refused envelopes are never forwarded');

  // 6. What is forwarded: the envelope unchanged, the browser's origin and agent, its address, and the upstream's rate-limit reply.
  for (const base of [nodeOrigin, pythonOrigin, nextOrigin]) {
    const sent = envelopeOf(captureDsn), reply = await post(`${base}/monitoring`, sent, { 'User-Agent': 'tunnel-journey-browser', Referer: `${base}/page`, 'X-Forwarded-For': '203.0.113.7, 10.0.0.1' });
    assert.equal(reply.status, 200); assert.equal(reply.headers.get('x-sentry-rate-limits'), '60:replay');
    const forwarded = seen.at(-1);
    assert.equal(forwarded.url, '/api/9/envelope/'); assert.equal(forwarded.body.toString(), sent);
    assert.equal(forwarded.headers['user-agent'], 'tunnel-journey-browser'); assert.equal(forwarded.headers.origin, nodeOrigin); assert.equal(forwarded.headers.referer, `${base}/page`);
    assert.equal(forwarded.headers['x-forwarded-for'], '203.0.113.7');
  }
  console.log(JSON.stringify({ passed: true, proof: 'Unmodified @sentry/browser with only DSN/tunnel changed: EasyPrivacy Sentry rules (Ghostery engine) block the default route; Node, real Next.js (build/start) and Python tunnels deliver; Spool origin enforcement, project fence and forwarded fields asserted.' }));
} finally {
  await browser?.close(); python?.kill(); nextServer?.kill(); nodeServer?.close(); capture?.close(); await worker?.stop(); await rm(temporary, { recursive: true, force: true });
}
