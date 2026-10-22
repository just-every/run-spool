// The Sentry browser SDK's standard `tunnel` option, through the tunnels Spool ships (@just-every/spool/tunnel and
// /next for Node and Next.js, spool_tunnel.py for Python), with the EasyPrivacy Sentry rules enforced in the browser.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { FiltersEngine, Request as AdRequest } from '@ghostery/adblocker';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';

const require = createRequire(import.meta.url), wait = ms => new Promise(done => setTimeout(done, ms));
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-tunnel-')), app = resolve(temporary, 'app'), site = resolve(temporary, 'site');
let worker, browser, python, nodeServer, capture, nextServer, redirector, foreign;
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(server.address().port)));
try {
  await mkdir(app); await mkdir(site);
  const packed = JSON.parse(execFileSync(process.execPath, ['packages/sdk/build.mjs', '--pack'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  await writeFile(resolve(app, 'package.json'), JSON.stringify({ name: 'fresh-app', private: true, type: 'module' }));
  execFileSync('npm', ['install', packed.tarball, '--offline', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: app, stdio: 'ignore' });

  worker = await startTestWorker(15571); const { origin } = worker, cookie = await signIn(origin);
  const request = async (path, method = 'GET', body) => { const response = await fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`); return response.json(); };
  const project = await request('/api/projects', 'POST', { id: 'tunnel', name: 'Tunnelled browser' }), other = await request('/api/projects', 'POST', { id: 'tunnel-other', name: 'Another project' });

  // A recording upstream stands in for Spool only to read exactly what the tunnels forward (a network-edge fake).
  const seen = [];
  capture = createServer(async (req, res) => { const chunks = []; for await (const chunk of req) chunks.push(chunk); seen.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) }); res.setHeader('x-sentry-rate-limits', '60:replay'); res.statusCode = 200; res.end('{}'); });
  const capturePort = await listen(capture), captureDsn = `http://synthetic-spool-1@127.0.0.1:${capturePort}/9`;
  // An upstream that redirects to another host, which would accept anything and records what reaches it (network-edge fakes).
  const foreignHits = [];
  foreign = createServer(async (req, res) => { for await (const _ of req); foreignHits.push(req.url); res.end('synthetic-spool-foreign-body'); });
  const foreignPort = await new Promise(done => foreign.listen(0, () => done(foreign.address().port)));
  let redirectStatus = 302;
  redirector = createServer(async (req, res) => { for await (const _ of req); res.statusCode = redirectStatus; res.setHeader('location', `http://localhost:${foreignPort}${req.url}`); res.end(); });
  const redirectDsn = `http://synthetic-spool-2@127.0.0.1:${await listen(redirector)}/9`;

  // One real browser SDK program; only the DSN and the `tunnel` option differ between pages.
  await writeFile(resolve(app, 'page.js'), `import * as Sentry from '@sentry/browser';\nSentry.init({dsn:globalThis.__DSN__,tunnel:globalThis.__TUNNEL__,release:'tunnel@1.0.0',environment:'tunnel'});\nwindow.report=message=>{Sentry.captureException(new Error(message));return Sentry.flush(5000)};\n`);
  await build({ entryPoints: [resolve(app, 'page.js')], outfile: resolve(site, 'page.js'), bundle: true, minify: true, format: 'esm', platform: 'browser', nodePaths: [resolve('node_modules')] });
  const html = (dsn, tunnel) => `<!doctype html><title>Tunnel page</title><script>globalThis.__DSN__=${JSON.stringify(dsn)};globalThis.__TUNNEL__=${tunnel ? JSON.stringify(tunnel) : 'undefined'}</script><script type="module" src="/page.js"></script>`;
  await writeFile(resolve(site, 'direct.html'), html(project.dsn));
  await writeFile(resolve(site, 'tunnel.html'), html(project.dsn, '/monitoring'));

  // Node http server with the installed package's nodeTunnel at /monitoring, in its own process like the Python one.
  nodeServer = spawn(process.execPath, ['tests/tunnel/server.mjs', resolve(app, 'node_modules/@just-every/spool/dist/tunnel.js'), site, project.dsn, captureDsn, redirectDsn], { stdio: ['ignore', 'pipe', 'inherit'] });
  process.once('exit', () => nodeServer.kill());
  const nodeOrigin = `http://127.0.0.1:${await new Promise((done, fail) => { nodeServer.once('error', fail); nodeServer.stdout.once('data', port => done(String(port).trim())); })}`;
  const pythonPort = 20000 + Math.floor(Math.random() * 20000), pythonOrigin = `http://127.0.0.1:${pythonPort}`;
  python = spawn('python3', ['tests/tunnel/server.py', String(pythonPort), site, project.dsn, captureDsn, redirectDsn], { stdio: ['ignore', 'pipe', 'inherit'] });
  process.once('exit', () => python.kill());
  await new Promise((done, fail) => { python.once('error', fail); python.stdout.once('data', done); });

  const envelopeOf = dsn => `${JSON.stringify({ event_id: 'a'.repeat(32), dsn })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify({ event_id: 'a'.repeat(32), release: 'tunnel@1.0.0', exception: { values: [{ type: 'Error', value: 'tunnelled', stacktrace: { frames: [{ filename: 'app.js', lineno: 1, colno: 1, function: 'next' }] } }] } })}`;
  const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { Origin: nodeOrigin, ...headers }, body });

  // Bounded body. The 1 MiB limit holds while the body is read and inflated: 255 KiB of gzip that expands to 256 MiB is
  // refused, costing the host under 32 MiB of peak memory (unbounded decoding cost 267-796 MiB). Each host gets the same
  // bomb just after it starts and serves one envelope, while its peak still matches its resident memory. It answers
  // /peak-rss with its process id and getrusage peak (KiB): the Node and Python test servers, and a route in the Next app
  // (step 4b). The answering process must be the one started here, with no child process. Its cost is its peak after the
  // request minus its resident memory just before it, which can only overstate the request. On Linux both figures are the
  // process's own VmHWM and VmRSS (/proc), since getrusage there also counts the parent's memory carried across exec;
  // elsewhere they are the getrusage peak and ps.
  const bomb = gzipSync(Buffer.concat([Buffer.from(JSON.stringify({ dsn: captureDsn }) + '\n'), Buffer.alloc(256 * 1024 * 1024)]), { level: 9 });
  const usage = async base => (await fetch(`${base}/peak-rss`)).json();
  const memoryOf = async (base, pid) => {
    if (process.platform !== 'linux') return { peak: (await usage(base)).maxRSS, resident: Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' })) };
    const status = await readFile(`/proc/${pid}/status`, 'utf8'), kib = name => Number(new RegExp(`^${name}:\\s*(\\d+) kB$`, 'm').exec(status)[1]);
    return { peak: kib('VmHWM'), resident: kib('VmRSS') };
  };
  const childrenOf = pid => execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n').map(line => line.trim().split(/\s+/).map(Number)).filter(([, parent]) => parent === pid).map(([child]) => child);
  const memory = [];
  const bounded = async (host, base, started) => {
    assert.equal((await post(`${base}/monitoring`, envelopeOf(captureDsn))).status, 200, `${base} serves an envelope`);
    const { pid } = await usage(base);
    assert.equal(pid, started.pid, `${base} answers from the host process this journey started`);
    assert.deepEqual(childrenOf(pid), [], `${base} serves from that one process, with no child process`);
    const before = await memoryOf(base, pid);
    assert.equal((await post(`${base}/monitoring`, bomb, { 'Content-Encoding': 'gzip' })).status, 413, `${base} refuses an envelope over 1 MiB once decoded`);
    const after = await memoryOf(base, pid), cost = after.peak - before.resident;
    memory.push({ host, pid, residentBeforeKiB: before.resident, peakBeforeKiB: before.peak, peakAfterKiB: after.peak, costKiB: cost });
    assert.ok(cost < 32 * 1024, `${base} refuses it within 32 MiB of peak memory (${cost} KiB)`);
    assert.equal((await post(`${base}/monitoring`, envelopeOf(captureDsn))).status, 200, `${base} keeps serving after the refusal`);
  };
  await bounded('node', nodeOrigin, nodeServer);
  await bounded('python', pythonOrigin, python);

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
  const nextEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SPOOL_DSN: project.dsn, SPOOL_TUNNEL_DSNS: `${project.dsn} ${captureDsn} ${redirectDsn}` };
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
  // This journey's own measurement route (bounded body, above), never part of what setup writes: the process's id and peak memory.
  await mkdir(resolve(nextDir, 'app/peak-rss'));
  await writeFile(resolve(nextDir, 'app/peak-rss/route.js'), "export const dynamic = 'force-dynamic';\nexport function GET() { return Response.json({ pid: process.pid, maxRSS: process.resourceUsage().maxRSS }); }\n");
  await writeFile(resolve(nextDir, 'instrumentation-client.js'), "import * as Sentry from '@sentry/nextjs';\nSentry.init({ dsn: process.env.NEXT_PUBLIC_SPOOL_DSN, tunnel: '/monitoring', release: 'next@1.0.0', environment: 'next' });\n");
  nextBuild();
  const nextPort = 20000 + Math.floor(Math.random() * 20000), nextOrigin = `http://127.0.0.1:${nextPort}`;
  nextServer = spawn(process.execPath, [nextBin, 'start', '-p', String(nextPort), '-H', '127.0.0.1'], { cwd: nextDir, env: nextEnv, stdio: ['ignore', 'pipe', 'inherit'] });
  process.once('exit', () => nextServer.kill());
  await new Promise((done, fail) => { nextServer.once('error', fail); nextServer.stdout.on('data', chunk => { if (/Ready/.test(String(chunk))) done(); }); });
  await bounded('next', nextOrigin, nextServer);
  await request('/api/projects/tunnel/browser-origins', 'POST', { origin: nextOrigin });
  // The click returns before the SDK's post of its error has left the browser (every request first waits in the list's
  // route above), and closing the context cancels it: the page closes only once the tunnel has answered for that envelope.
  const nextPage = await newPage(); await nextPage.goto(nextOrigin); await nextPage.waitForLoadState('networkidle');
  const tunnelled = nextPage.waitForResponse(response => response.url() === `${nextOrigin}/monitoring` && (response.request().postData() ?? '').includes('next checkout failure'));
  await nextPage.getByRole('button').click(); assert.equal((await tunnelled).status(), 200, 'the Next tunnel forwards the click’s error'); await nextPage.context().close();
  await arrives('next checkout failure');


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

  // 7. Hostile requests. A TRACE and an upload the client abandons end that request only: each host keeps serving.
  const raw = (base, text, hold = 2000) => new Promise(done => { const socket = connect(Number(new URL(base).port), '127.0.0.1', () => socket.write(text)); socket.on('data', () => {}); socket.on('error', done); socket.on('close', done); setTimeout(() => socket.destroy(), hold); });
  const tunnels = [nodeOrigin, pythonOrigin, nextOrigin];
  for (const base of tunnels) {
    await raw(base, 'TRACE /monitoring HTTP/1.1\r\nHost: tunnel\r\nConnection: close\r\n\r\n');
    await raw(base, 'POST /monitoring HTTP/1.1\r\nHost: tunnel\r\nContent-Length: 100000\r\n\r\nsynthetic-spool-partial', 200);
    assert.equal((await post(`${base}/monitoring`, envelopeOf(captureDsn))).status, 200, `${base} keeps serving after a TRACE and an aborted upload`);
  }
  assert.equal(nodeServer.exitCode, null, 'the Node host process is still running');
  // No redirect is followed or relayed: the envelope goes to the configured Spool origin or nowhere.
  for (const base of tunnels) for (redirectStatus of [301, 302, 303, 307, 308]) {
    const reply = await post(`${base}/monitoring`, envelopeOf(redirectDsn));
    assert.equal(reply.status, 502, `${base} refuses an upstream ${redirectStatus}`); assert.ok(!(await reply.text()).includes('synthetic-spool-foreign-body'), 'the redirected host’s body is never relayed');
  }
  assert.deepEqual(foreignHits, [], 'nothing reaches the host a redirect names');
  console.log(JSON.stringify({ passed: true, memory: { platform: process.platform, source: process.platform === 'linux' ? '/proc/<pid>/status VmHWM after minus VmRSS before (KiB)' : 'getrusage maxRSS after minus ps rss before (KiB)', hosts: memory }, proof: 'Unmodified @sentry/browser with only DSN/tunnel changed: EasyPrivacy Sentry rules (Ghostery engine) block the default route; Node, real Next.js (build/start) and Python tunnels deliver; Spool origin enforcement, project fence and forwarded fields asserted; hosts survive TRACE and aborted uploads, follow no redirect, and refuse a decompression bomb within 32 MiB of peak memory on each of the three hosts.' }));
} finally {
  await browser?.close(); python?.kill(); nextServer?.kill(); nodeServer?.kill(); capture?.close(); redirector?.close(); foreign?.close(); await worker?.stop(); await rm(temporary, { recursive: true, force: true });
}
