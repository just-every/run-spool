// [SRC-001][SRC-004] The published SDK, as a user gets it: the packed tarball installed into a fresh app, sending through Spool's public ingest door.
import {sourceMapPlugins} from './source-map-plugins.mjs';
import {sourceMapCapacity} from './source-map-capacity.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as viteBuild } from 'vite';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';

const temporary = await mkdtemp(resolve(tmpdir(), 'spool-sdk-package-')), app = resolve(temporary, 'fresh-app');
let worker, browser, server;
const wait = ms => new Promise(done => setTimeout(done, ms));
try {
  const packed = JSON.parse(execFileSync(process.execPath, ['packages/sdk/build.mjs', '--pack'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  await mkdir(app);
  await writeFile(resolve(app, 'package.json'), JSON.stringify({ name: 'fresh-app', private: true, type: 'module' }));
  execFileSync('npm', ['install', packed.tarball, '--offline', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: app, stdio: 'ignore' });
  const installed = JSON.parse(await readFile(resolve(app, 'node_modules/@just-every/spool/package.json'), 'utf8'));
  assert.ok(!installed.dependencies, 'the package installs with no runtime dependencies');

  worker = await startTestWorker(15561); const { origin } = worker, cookie = await signIn(origin);
  const request = async (path, method = 'GET', body) => { const response = await fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`); return response.json(); };
  const project = await request('/api/projects', 'POST', { id: 'fresh', name: 'Fresh app' });
  const deploy = await request('/api/projects/fresh/keys', 'POST', { kind: 'deploy' });
  const issueFor = async release => {
    for (let attempt = 0; attempt < 100; attempt++) {
      for (const issue of await request('/api/projects/fresh/issues')) {
        const packet = await request(`/api/projects/fresh/issues/${issue.id}/packet`), captured = packet.events.find(row => row.event.release === release);
        if (captured) return { ...captured, issueId: issue.id };
      }
      await wait(100);
    }
    assert.fail(`no issue for ${release}`);
  };

  // Browser: the three-line init in a page built with the package's own Vite plugin, which uploads the map.
  const source = `import { init, breadcrumb } from '@just-every/spool';\nwindow.__installSpool=()=>window.__client=init({ ...window.__SPOOL__ });\nwindow.__installSpool();\nbreadcrumb('checkout', 'card 4242 4242 4242 4242 password=FRESH_APP_SECRET');\ndocument.querySelector('button').onclick = () => setTimeout(function checkout() {\n  const account = {};\n  return account.address.city;\n}, 0);\n`;
  const thrownLine = source.split('\n').findIndex(line => line.includes('account.address.city')) + 1;
  await writeFile(resolve(app, 'main.js'), source);
  const { spoolSourceMaps } = await import(pathToFileURL(resolve(app, 'node_modules/@just-every/spool/dist/vite.js')).href);
  process.env.FRESH_APP_DEPLOY_KEY = deploy.key;
  await viteBuild({ configFile: false, root: app, logLevel: 'silent', plugins: [spoolSourceMaps({ endpoint: origin, project: 'fresh', release: 'web@1.0.0', build: 'b1', keyEnv: 'FRESH_APP_DEPLOY_KEY' })], build: { outDir: resolve(app, 'dist'), sourcemap: true, minify: 'esbuild', lib: { entry: resolve(app, 'main.js'), formats: ['es'], fileName: () => 'app.js' } } });
  delete process.env.FRESH_APP_DEPLOY_KEY;
  const bundle = await readFile(resolve(app, 'dist/app.js'), 'utf8');
  assert.ok(!bundle.includes(deploy.key), 'the deploy key stays out of the bundle');
  const config = { endpoint: origin, project: 'fresh', ingestKey: project.ingestKey, release: 'web@1.0.0', build: 'b1' };
  // /wrapped is the same app behind a common fetch wrapper that reports every non-OK response as a page error.
  const wrapper = `window.__pageErrors=0;addEventListener('error',()=>{window.__pageErrors++});const original=fetch;window.fetch=async(...args)=>{const response=await original(...args);if(!response.ok)reportError(new Error('HTTP '+response.status));return response};`;
  server = createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
    const wrapped = req.url === '/wrapped', noisy = req.url === '/noisy', closing = req.url === '/closing', pageConfig = wrapped ? { ...config, release: 'web@2.0.0' } : config;
    // /noisy: a timer throws an error with a new message every 20 ms for 2 s, and another location throws once at 1.5 s.
    const outcomes = noisy ? 'window.__outcomes={};window.__SPOOL__.onOutcome=result=>{const key=result.outcome+"/"+(result.reason??"");window.__outcomes[key]=(window.__outcomes[key]??0)+1};' : closing ? 'window.__outcomes=[];window.__SPOOL__.onOutcome=result=>window.__outcomes.push(result);' : '';
    const noise = noisy ? `<script type="module">let n=0;const noise=setInterval(function tick(){throw new Error('tick '+(n++))},20);setTimeout(()=>clearInterval(noise),2000);setTimeout(function genuine(){throw new Error('genuine failure at another location')},1500);</script>` : '';
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><title>Fresh app</title><button>Throw</button><script>${wrapped ? wrapper : ''}window.__SPOOL__=${JSON.stringify(pageConfig)};${outcomes}</script><script type="module" src="/app.js"></script>${noise}`);
  });
  const appOrigin = await new Promise(done => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`)));
  await request('/api/projects/fresh/browser-origins', 'POST', { origin: appOrigin });
  browser = await launchBrowser(); const page = await browser.newPage();
  await page.goto(appOrigin); await page.waitForLoadState('networkidle'); await page.getByRole('button').click();
  const fromBrowser = await issueFor('web@1.0.0');
  assert.equal(fromBrowser.atAdmission[0].status, 'mapped', 'the debug ID registered by the plugin maps the frame without an init option');
  assert.equal(fromBrowser.atAdmission[0].original.line, thrownLine);
  assert.match(fromBrowser.event.breadcrumbs.at(-1), /^checkout: /);
  assert.ok(!JSON.stringify(fromBrowser).includes('FRESH_APP_SECRET') && !JSON.stringify(fromBrowser).includes('4242 4242'), 'breadcrumbs are scrubbed');

  // A page without crypto.randomUUID (any plain http:// origin that is not loopback): the error still arrives and the SDK adds no errors of its own.
  const insecure = await browser.newPage(), pageErrors = [];
  insecure.on('pageerror', error => pageErrors.push(error.message));
  await insecure.addInitScript(() => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined }); });
  await insecure.goto(appOrigin); await insecure.waitForLoadState('networkidle'); await insecure.getByRole('button').click();
  for (let attempt = 0; attempt < 100 && !(await request('/api/projects/fresh/issues')).some(issue => issue.id === fromBrowser.issueId && issue.count >= 2); attempt++) await wait(100);
  await wait(500);
  assert.ok((await request('/api/projects/fresh/issues')).some(issue => issue.id === fromBrowser.issueId && issue.count >= 2), 'the page error arrives without crypto.randomUUID');
  assert.deepEqual(pageErrors.map(message => /city/.test(message)), [true], 'the only page error is the app’s own');

  // A page whose fetch wrapper reports Spool's refusals as page errors (here 422: the release is not registered yet):
  // the SDK's own refused sends do not feed back into more sends, and once the release is registered the error arrives.
  const wrappedPage = await browser.newPage(), ingests = [];
  wrappedPage.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/ingest/')) ingests.push(request.url()); });
  await wrappedPage.goto(`${appOrigin}/wrapped`); await wrappedPage.waitForLoadState('networkidle'); await wrappedPage.getByRole('button').click();
  await wait(2000);
  const settledSends = ingests.length;
  await wait(2000);
  assert.equal(ingests.length, settledSends, 'refused sends stop instead of feeding back');
  assert.ok(settledSends >= 1 && settledSends < 10, `a handful of sends, not a stream (${settledSends})`);
  assert.ok(await wrappedPage.evaluate(() => window.__pageErrors) < 10, 'the page’s own error handlers are not flooded');
  await request('/api/projects/fresh/releases', 'POST', { name: 'web@2.0.0', build: 'b1' });
  await wrappedPage.reload(); await wrappedPage.waitForLoadState('networkidle'); await wrappedPage.getByRole('button').click();
  assert.match((await issueFor('web@2.0.0')).event.message, /city/, 'the page’s own error arrives once Spool accepts it');

  // A noisy location cannot starve another: the genuine error arrives, the noise is capped, and every error the SDK
  // did not send settles as dropped in the page and is counted on the noisy issue in Spool.
  const noisyPage = await browser.newPage();
  await noisyPage.goto(`${appOrigin}/noisy`);
  let issues = [], noisyIssue, outcomes = {};
  for (let attempt = 0; attempt < 100; attempt++) {
    await wait(200);
    issues = await request('/api/projects/fresh/issues'); outcomes = await noisyPage.evaluate(() => window.__outcomes);
    noisyIssue = issues.find(issue => /tick/.test(issue.title));
    if (attempt > 15 && noisyIssue && noisyIssue.client_dropped === outcomes['dropped/client_cap'] && noisyIssue.count === outcomes['accepted/'] - 1) break;
  }
  assert.ok(issues.some(issue => /genuine failure at another location/.test(issue.title)), 'an error at another location arrives while the noise is capped');
  assert.ok(outcomes['dropped/client_cap'] > 0, 'errors over the cap settle through onOutcome as dropped');
  assert.equal(noisyIssue.client_dropped, outcomes['dropped/client_cap'], 'Spool counts every error the SDK dropped on the noisy issue');
  assert.equal(noisyIssue.count, outcomes['accepted/'] - 1, 'the noisy issue holds every noise error sent');
  const packet = await request(`/api/projects/fresh/issues/${noisyIssue.id}/packet`);
  assert.equal(packet.issue.client_dropped, noisyIssue.client_dropped);
  await noisyPage.close();

  // Closing a client settles its held error and clears the refill timer. A fresh init can send at the same location
  // immediately, and the retired listener cannot send its former held error later.
  const closingPage = await browser.newPage(), closingSends = [];
  closingPage.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/ingest/')) closingSends.push(JSON.parse(request.postData())); });
  await closingPage.goto(`${appOrigin}/closing`);
  const closingBurst = await closingPage.evaluate(() => {
    const outcomeStart = window.__outcomes.length;
    let n = 0;
    while (!window.__outcomes.some(result => result.outcome === 'dropped' && result.reason === 'client_cap') && n < 1000) {
      const message = `closing ${n}`, error = new Error(message);
      error.stack = `Error: ${message}\n    at closeBurst (https://closing.example.test/app.js:123:1)`;
      dispatchEvent(new ErrorEvent('error', { error, message }));
      n++;
    }
    if (!window.__outcomes.some(result => result.outcome === 'dropped' && result.reason === 'client_cap')) throw new Error('the public listener did not cap this location');
    const heldMessage = `closing ${n - 1}`, beforeDrops = window.__outcomes.filter(result => result.outcome === 'dropped' && result.reason === 'client_cap').length;
    window.__client.close();
    const afterDrops = window.__outcomes.filter(result => result.outcome === 'dropped' && result.reason === 'client_cap').length;
    window.__installSpool();
    const message = 'reinitialized', error = new Error(message);
    error.stack = `Error: ${message}\n    at closeBurst (https://closing.example.test/app.js:123:1)`;
    dispatchEvent(new ErrorEvent('error', { error, message }));
    return { heldMessage, offered: n, outcomeStart, closeDrops: afterDrops - beforeDrops };
  });
  assert.ok(closingBurst.closeDrops > 0, 'closing settles the held error as a client cap drop');
  for (let attempt = 0; attempt < 100 && await closingPage.evaluate(({ target }) => window.__outcomes.length < target, { target: closingBurst.outcomeStart + closingBurst.offered + 1 }); attempt++) await wait(20);
  const sendsAfterReinit = closingSends.length;
  assert.ok(sendsAfterReinit > 0 && closingSends.some(event => event.message === 'reinitialized'), 'the reinitialized error reaches the public transport');
  await wait(2200);
  assert.equal(closingSends.length, sendsAfterReinit, 'the retired client sends no delayed error after close and re-init');
  assert.ok(!closingSends.some(event => event.message === closingBurst.heldMessage), 'the held error from the closed client is not sent');
  // A long stack (Safari keeps 100 frames, Firefox 128) from a new location is cut at a line boundary and sent, not dropped.
  await closingPage.evaluate(() => {
    const error = new TypeError('deep render failure');
    error.stack = Array.from({ length: 100 }, (_, i) => `renderWithHooks${i}@https://deep.example.test/_next/static/chunks/framework-0123456789abcdef.js:1:${10000 + i}`).join('\n');
    dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  });
  for (let attempt = 0; attempt < 100 && !closingSends.some(event => event.message === 'deep render failure'); attempt++) await wait(20);
  const deep = closingSends.find(event => event.message === 'deep render failure');
  assert.equal(deep?.frames[0].function, 'renderWithHooks0', 'an error with a long stack from a new location is sent with its top frame');
  // A multi-line message over 8,192 characters (a ZodError) must not hide the frames behind it.
  await closingPage.evaluate(() => {
    const error = new Error(JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ code: 'invalid_type', path: ['items', i] })), null, 2));
    error.name = 'ZodError';
    error.stack = `ZodError: ${error.message}\n    at parseItems (https://zod.example.test/app.js:42:7)\n    at run (https://zod.example.test/app.js:50:3)`;
    dispatchEvent(new ErrorEvent('error', { error, message: 'zod failure' }));
  });
  for (let attempt = 0; attempt < 100 && !closingSends.some(event => event.frames?.[0]?.function === 'parseItems'); attempt++) await wait(20);
  assert.ok(closingSends.some(event => event.frames?.[0]?.function === 'parseItems'), 'a long multi-line message from a new location is sent with its first frame');
  await closingPage.close();

  // Node: an uncaught exception is reported, then the process exits with code 1 as Node would.
  await request('/api/projects/fresh/releases', 'POST', { name: 'api@1.0.0', build: 'n1' });
  await writeFile(resolve(app, 'server.mjs'), `import { init } from '@just-every/spool/node';\ninit(${JSON.stringify({ ...config, release: 'api@1.0.0', build: 'n1' })});\nsetTimeout(function handleOrder() { null.total; }, 0);\n`);
  const exitCode = await new Promise((done, fail) => { const child = spawn(process.execPath, ['server.mjs'], { cwd: app, stdio: 'ignore' }); child.once('error', fail); child.once('exit', done); });
  assert.equal(exitCode, 1);
  const fromNode = await issueFor('api@1.0.0');
  assert.match(fromNode.event.frames[0].function, /handleOrder/);

  // An unusual but valid error shape: Node still prints the app's own error, exits 1 and reports it.
  await request('/api/projects/fresh/releases', 'POST', { name: 'api@1.0.1', build: 'n2' });
  await writeFile(resolve(app, 'odd.mjs'), `import { init } from '@just-every/spool/node';\ninit(${JSON.stringify({ ...config, release: 'api@1.0.1', build: 'n2' })});\nsetTimeout(function handleRefund() { const error = new Error('refund total missing'); error.name = 'R'.repeat(150); throw error; }, 0);\n`);
  const odd = await new Promise((done, fail) => { const child = spawn(process.execPath, ['odd.mjs'], { cwd: app, stdio: ['ignore', 'ignore', 'pipe'] }); let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.once('error', fail); child.once('exit', code => done({ code, stderr })); });
  assert.equal(odd.code, 1);
  assert.match(odd.stderr, /refund total missing/, 'the crash output is the app’s own error');
  assert.match((await issueFor('api@1.0.1')).event.message, /refund total missing/);

  // A host whose fetch never settles and whose timers keep throwing: the app's first error is printed and the process exits 1.
  await writeFile(resolve(app, 'stuck.mjs'), `globalThis.fetch = () => new Promise(() => {});\nconst { init } = await import('@just-every/spool/node');\ninit(${JSON.stringify({ ...config, release: 'api@1.0.1', build: 'n2', exitTimeoutMs: 300 })});\nsetTimeout(function handleExport() { throw new Error('export file missing'); }, 0);\nsetInterval(() => { throw 'later timer failure'; }, 20);\n`);
  const stuck = await new Promise((done, fail) => { const child = spawn(process.execPath, ['stuck.mjs'], { cwd: app, stdio: ['ignore', 'ignore', 'pipe'] }); let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.once('error', fail); child.once('exit', code => done({ code, stderr })); });
  assert.equal(stuck.code, 1, 'a fetch that never settles does not turn the crash into exit 0');
  assert.match(stuck.stderr, /export file missing/, 'the crash output is the app’s first error');
  assert.doesNotMatch(stuck.stderr, /later timer failure/, 'a later throw does not replace the first error');

  // Worker: the README's catch block with an unset option still returns the app's own response.
  const workerSdk = await import(pathToFileURL(resolve(app, 'node_modules/@just-every/spool/dist/worker.js')).href), kept = [];
  const handle = () => { try { throw new Error('edge failure'); } catch (error) { workerSdk.captureException(error, { ...config, build: undefined }, { waitUntil: work => kept.push(work) }); return new Response('Internal error', { status: 500 }); } };
  assert.equal(handle().status, 500);
  assert.equal((await kept[0]).reason, 'invalid_options', 'a missing option settles as rejected instead of throwing');
  await sourceMapCapacity({origin,request,app,browser});
  await sourceMapPlugins({origin,request,app,browser,cookie});
  console.log(JSON.stringify({ passed: true, proof: 'Packed tarball installed offline into a fresh app: browser init with plugin-mapped frame and scrubbed breadcrumb, the same page without crypto.randomUUID, a fetch wrapper reporting refused sends without a feedback loop, a noisy location capped while another location’s error arrives and every drop counted on its issue, Node uncaught exception (and an odd-shaped one) reported then exit 1 with the app error, even with a never-settling fetch and a second throw, Worker catch block kept with a missing option.' }));
} finally {
  delete process.env.FRESH_APP_DEPLOY_KEY;
  await browser?.close(); if (server) await new Promise(done => server.close(done)); await worker?.stop();
  await rm(temporary, { recursive: true, force: true });
}
