// [SDK-020] The guided setup command, as a user gets it: the packed `spool-setup` bin run on fresh Django and Next.js apps.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { FiltersEngine, Request as AdRequest } from '@ghostery/adblocker';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';
import { readScreens } from './runtimes/screens.mjs';

const wait = ms => new Promise(done => setTimeout(done, ms));
const started = performance.now();
const stage = name => console.log(`[wizard] ${name} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-setup-')), tool = resolve(temporary, 'tool');
let worker, browser, server, nextServer, elsewhere, hop;
const children = [];
try {
  stage('pack and install setup command');
  await mkdir(tool);
  const packed = JSON.parse(execFileSync(process.execPath, ['packages/sdk/build.mjs', '--pack'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  await writeFile(resolve(tool, 'package.json'), JSON.stringify({ name: 'tool', private: true, type: 'module' }));
  execFileSync('npm', ['install', packed.tarball, '--offline', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: tool, stdio: 'ignore' });
  const bin = resolve(tool, 'node_modules/@just-every/spool/dist/setup.js');
  // Asynchronous, so the journey's own network-edge fakes keep answering while the command runs.
  const wizard = (args, { stdio = 'pipe' } = {}) => new Promise((done, fail) => {
    const child = spawn(process.execPath, [bin, ...args], { stdio }), out = { stdout: '', stderr: '' };
    child.stdout?.on('data', chunk => out.stdout += chunk); child.stderr?.on('data', chunk => out.stderr += chunk);
    child.once('error', fail); child.once('close', status => done({ status, ...out }));
  });
  stage('start emitted Worker and sign in');
  worker = await startTestWorker(15572); const { origin } = worker, cookie = await signIn(origin);
  const request = async (path, method = 'GET', body) => { const response = await fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`); return response.json(); };
  const project = await request('/api/projects', 'POST', { id: 'setup', name: 'Guided setup' });
  const issues = () => request('/api/projects/setup/issues');
  const arrives = async text => { for (let attempt = 0; attempt < 150; attempt++) { if ((await issues()).some(issue => issue.title.includes(text))) return; await wait(100); } assert.fail(`${text} never arrived`); };
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=synthetic-spool@example.test', '-c', 'user.name=synthetic-spool', ...args], { cwd, encoding: 'utf8' });

  // Refusals first: a malformed DSN, an unsupported framework, and a DSN Spool does not know.
  stage('DSN and framework refusals');
  assert.equal((await wizard(['--dsn', 'not-a-dsn'])).status, 1);
  const rails = resolve(temporary, 'rails-app'); await mkdir(rails); await writeFile(resolve(rails, 'Gemfile'), "source 'https://rubygems.org'\ngem 'rails'\n");
  const guided = await wizard(['--dsn', project.dsn, '--dir', rails, '--no-test-event']);
  assert.equal(guided.status, 0); assert.match(guided.stdout, /Detected rails/); assert.match(guided.stdout, /sentry-rails/); assert.ok(!guided.stdout.includes('diff --git'), 'frameworks without a generator get guidance, not a patch');
  const forged = project.dsn.replace(/\/\/./, m => '//' + (project.dsn[7] === '0' ? '1' : '0'));
  const refused = await wizard(['--dsn', forged, '--dir', rails]);
  assert.equal(refused.status, 1); assert.match(refused.stdout, /refused the test event \(HTTP 401\)/);

  // A refused setup writes nothing: a DSN Spool does not accept, one that redirects or names a host that is not Spool,
  // a secret key (never printed or written), control characters, and a project file that links outside the project.
  const settingsOnly = async name => { const root = resolve(temporary, name); await mkdir(resolve(root, 'shop'), { recursive: true }); await writeFile(resolve(root, 'manage.py'), "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shop.settings')\n"); await writeFile(resolve(root, 'shop/settings.py'), 'DEBUG = True\n'); return root; };
  const untouched = async (root, label, extra = []) => { assert.deepEqual((await readdir(root)).sort(), ['manage.py', 'shop', ...extra].sort(), `${label}: no file created`); assert.equal(await readFile(resolve(root, 'shop/settings.py'), 'utf8'), 'DEBUG = True\n', `${label}: settings unchanged`); };
  // Network-edge fakes: /7 redirects to Spool's own intake (307 keeps the POST), /8 answers 200 without being Spool.
  const key = new URL(project.dsn).username, alias = new URL(project.dsn).pathname.slice(1);
  elsewhere = createServer(async (req, res) => { for await (const _ of req); if (req.url.startsWith('/api/7/')) { res.statusCode = 307; res.setHeader('location', `${origin}/api/${alias}/envelope/`); } res.end('{}'); });
  const elsewherePort = await new Promise(done => elsewhere.listen(0, '127.0.0.1', () => done(elsewhere.address().port)));
  const issuesBefore = (await issues()).length;
  for (const [label, dsn, extra = []] of [['wrong key', forged], ['redirect', `http://${key}@127.0.0.1:${elsewherePort}/7`], ['not Spool', `http://${key}@127.0.0.1:${elsewherePort}/8`], ['secret key', project.dsn.replace('@', ':synthetic-spool-secret@')], ['secret key without a test event', project.dsn.replace('@', ':synthetic-spool-secret@'), ['--no-test-event']], ['newline', `${project.dsn}#\nINJECTED=1`, ['--no-test-event']]]) {
    const root = await settingsOnly(label.replaceAll(' ', '-')), run = await wizard(['--dsn', dsn, '--dir', root, '--apply', ...extra]);
    assert.equal(run.status, 1, `${label}: refused`); assert.doesNotMatch(run.stdout, /accepted by Spool/);
    assert.ok(!(run.stdout + run.stderr).includes('synthetic-spool-secret'), `${label}: no secret printed`);
    await untouched(root, label);
  }
  assert.equal((await issues()).length, issuesBefore, 'a redirected test event never reaches Spool');
  // A project file that is a link or a hard link to a file outside the project is never written through, and neither is
  // a link swapped in while the test event is in flight: a network-edge hop relays it to Spool and holds Spool's answer
  // until the link is in place (another project, so this project's issues stay as they are).
  const outside = resolve(temporary, 'outside.env');
  stage('linked file and settings refusals');
  await writeFile(outside, 'OUTSIDE=1\n');
  const later = await request('/api/projects', 'POST', { id: 'setup-later', name: 'Link swapped in' }), spool = new URL(origin);
  let swap;
  // The native host/DSN guard admits only its canonical origin. This network
  // edge normalizes the proxy's envelope origin to that upstream origin while
  // preserving its exact key, project and event bytes. No application admission
  // or file-safety check is replaced, and the real intake receipt is held.
  hop = createServer(async (req, res) => {
    const chunks=[]; for await(const chunk of req)chunks.push(chunk);
    const [first,...items]=Buffer.concat(chunks).toString().split('\n'),header=JSON.parse(first),incoming=new URL(header.dsn),target=new URL(later.dsn);
    assert.equal(incoming.username,target.username);assert.equal(incoming.pathname,target.pathname);
    header.dsn=later.dsn;
    const body=Buffer.from([JSON.stringify(header),...items].join('\n')),headers={...req.headers,host:spool.host,'content-length':String(body.byteLength)};delete headers['transfer-encoding'];
    const upstream=httpRequest({host:spool.hostname,port:spool.port,method:req.method,path:req.url,headers},async answer=>{
      const received=[];for await(const chunk of answer)received.push(chunk);
      await swap();res.writeHead(answer.statusCode,answer.headers).end(Buffer.concat(received));
    });
    upstream.on('error',()=>res.destroy());upstream.end(body);
  });
  const hopPort = await new Promise(done => hop.listen(0, '127.0.0.1', () => done(hop.address().port)));
  for (const [shape, arrange, held] of [['link', root => symlink(outside, resolve(root, '.env'))], ['hard link', root => link(outside, resolve(root, '.env'))], ['link swapped in', root => { swap = () => symlink(outside, resolve(root, '.env')); }, true]]) {
    const root = await settingsOnly(shape.replaceAll(' ', '-')); await arrange(root);
    const run = await wizard(['--dsn', held ? later.dsn.replace(/@[^/]+\//, `@127.0.0.1:${hopPort}/`) : project.dsn, '--dir', root, '--apply', ...held ? [] : ['--no-test-event']]);
    assert.equal(run.status, 1, `${shape}: refused`); assert.match(run.stderr, /\.env (is a link|shares its data)/, shape+': '+run.stdout.replace(/https?:\/\/[^\s]+/g,'<url>')); if (held) assert.match(run.stdout, /accepted by Spool/);
    assert.equal(await readFile(outside, 'utf8'), 'OUTSIDE=1\n', `${shape}: nothing written to the file outside the project`); await untouched(root, shape, ['.env']);
  }
  // A settings module that is not a dotted name gets no patch and no write (a patch git apply would refuse, before).
  const dotted = await settingsOnly('dotted'); await writeFile(resolve(dotted, 'manage.py'), "os.environ.setdefault('DJANGO_SETTINGS_MODULE', '..shop.settings')\n");
  for (const apply of [[], ['--apply']]) { const run = await wizard(['--dsn', project.dsn, '--dir', dotted, '--no-test-event', ...apply]); assert.equal(run.status, 1, 'a settings module that is not a dotted name is refused'); assert.ok(!run.stdout.includes('diff --git'), 'no patch for a settings module that is not a dotted name'); }
  await untouched(dotted, 'dotted');

  // Django: a fresh project, a reviewable patch first, then the same change applied with the SDK installed.
  stage('install Django and configure its SDK');
  const django = resolve(temporary, 'django-app'); await mkdir(django);
  execFileSync('python3', ['-m', 'venv', resolve(temporary, 'venv')]);
  const python = resolve(temporary, 'venv/bin/python');
  execFileSync(python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', 'django==5.2.8'], { stdio: 'inherit' });
  execFileSync(python, ['-m', 'django', 'startproject', 'shop', '.'], { cwd: django });
  await writeFile(resolve(django, 'requirements.txt'), 'django==5.2.8\n');
  git(django, 'init', '-q'); git(django, 'add', '-A'); git(django, 'commit', '-q', '-m', 'fresh app');
  const dry = await wizard(['--dsn', project.dsn, '--dir', django, '--no-test-event', '--python', python]);
  assert.match(dry.stdout, /Python has no source maps/);
  assert.equal(dry.status, 0, dry.stderr); assert.match(dry.stdout, /Detected django/); assert.match(dry.stdout, /diff --git a\/shop\/settings\.py/); assert.match(dry.stdout, /Nothing written/);
  assert.equal(git(django, 'status', '--porcelain'), '', 'the dry run changes nothing');
  const patch = dry.stdout.slice(dry.stdout.indexOf('diff --git')).split('\nRun:')[0] + '\n';
  await writeFile(resolve(temporary, 'django.patch'), patch);
  git(django, 'apply', '--check', resolve(temporary, 'django.patch'));
  git(django, 'apply', resolve(temporary, 'django.patch'));
  const reviewed = { settings: await readFile(resolve(django, 'shop/settings.py'), 'utf8'), env: await readFile(resolve(django, '.env'), 'utf8'), requirements: await readFile(resolve(django, 'requirements.txt'), 'utf8') };
  git(django, 'checkout', '-q', '.'); git(django, 'clean', '-fdq');
  const applied = await wizard(['--dsn', project.dsn, '--dir', django, '--apply', '--install', '--python', python], { stdio: ['ignore', 'pipe', 'inherit'] });
  assert.equal(applied.status, 0); assert.match(applied.stdout, /Test event [0-9a-f]{32} accepted by Spool/);
  assert.equal(await readFile(resolve(django, 'shop/settings.py'), 'utf8'), reviewed.settings, 'applying the change writes exactly the reviewed patch');
  assert.equal(await readFile(resolve(django, '.env'), 'utf8'), reviewed.env); assert.equal(await readFile(resolve(django, 'requirements.txt'), 'utf8'), reviewed.requirements);
  execFileSync(python, ['-c', 'import sentry_sdk'], { stdio: 'ignore' });
  const again = await wizard(['--dsn', project.dsn, '--dir', django, '--apply', '--no-test-event']);
  assert.match(again.stdout, /already configured/); assert.equal((await readFile(resolve(django, 'shop/settings.py'), 'utf8')), reviewed.settings, 'setup is idempotent');
  await arrives('Spool setup test event');
  // The configured app reports a real request failure through the Django integration, with no further setup.
  stage('capture real Django failure');
  await writeFile(resolve(django, 'shop/urls.py'), "from django.urls import path\n\ndef boom(request):\n    raise RuntimeError('django setup failure')\n\nurlpatterns = [path('boom', boom)]\n");
  const djangoPort = 20000 + Math.floor(Math.random() * 20000);
  const runserver = spawn(python, ['manage.py', 'runserver', '--noreload', `127.0.0.1:${djangoPort}`], { cwd: django, env: { ...process.env, SPOOL_DSN: project.dsn, DEBUG: '' }, stdio: 'ignore' });
  children.push(runserver);
  for (let attempt = 0; attempt < 100; attempt++) { try { await fetch(`http://127.0.0.1:${djangoPort}/boom`); break; } catch { await wait(200); } }
  await arrives('RuntimeError: django setup failure');

  // Next.js: a fresh app configured by the command, then built and served, with the EasyPrivacy Sentry rules enforced.
  stage('install Next.js');
  const next = resolve(temporary, 'next-app'); await mkdir(resolve(next, 'app'), { recursive: true });
  await writeFile(resolve(next, 'package.json'), JSON.stringify({ name: 'fresh-next', private: true, type: 'module', dependencies: { next: '16.4.2', react: '19.2.8', 'react-dom': '19.2.8' } }));
  await writeFile(resolve(next, 'app/layout.js'), 'export default function Layout({ children }) { return <html lang="en"><body>{children}</body></html>; }\n');
  await writeFile(resolve(next, 'app/page.js'), "'use client';\nexport default function Page() { return <button onClick={() => { throw new Error('next setup failure'); }}>Throw</button>; }\n");
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: next, stdio: 'ignore' });
  await writeFile(resolve(next, '.gitignore'), 'node_modules/\n.next/\n');
  git(next, 'init', '-q'); git(next, 'add', '-A'); git(next, 'commit', '-q', '-m', 'fresh app');
  for (const file of ['next.config.mjs', 'spool-build.mjs']) for (const shape of ['link', 'hard link']) {
    await (shape === 'link' ? symlink(outside, resolve(next, file)) : link(outside, resolve(next, file)));
    const refused = await wizard(['--dsn', project.dsn, '--dir', next, '--apply', '--no-test-event']);
    assert.equal(refused.status, 1, file + ' ' + shape + ' refused');
    assert.equal(await readFile(outside, 'utf8'), 'OUTSIDE=1\n');
    assert.equal(await readdir(resolve(next, 'app')).then(files => files.includes('monitoring')), false, 'refusal writes no other configuration');
    await rm(resolve(next, file));
  }
  const nextDry = await wizard(['--dsn', project.dsn, '--dir', next, '--no-test-event']);
  stage('configure Next.js and install its SDK');
  assert.equal(nextDry.status, 0, nextDry.stderr);
  const nextPatch = nextDry.stdout.slice(nextDry.stdout.indexOf('diff --git')).split('\nRun:')[0] + '\n';
  await writeFile(resolve(temporary, 'next.patch'), nextPatch); git(next, 'apply', resolve(temporary, 'next.patch'));
  const nextFiles = ['next.config.mjs', 'spool-build.mjs', 'app/monitoring/route.js', 'instrumentation-client.js', '.env.local'];
  const nextReviewed = await Promise.all(nextFiles.map(file => readFile(resolve(next, file), 'utf8')));
  git(next, 'checkout', '-q', '.'); git(next, 'clean', '-fdq');
  const nextRun = await wizard(['--dsn', project.dsn, '--dir', next, '--apply', '--install', '--spool-package', packed.tarball, '--no-test-event'], { stdio: ['ignore', 'pipe', 'inherit'] });
  assert.equal(nextRun.status, 0); assert.match(nextRun.stdout, /Detected next/); assert.match(nextRun.stdout, /tunnelRoute/);
  assert.deepEqual(await Promise.all(nextFiles.map(file => readFile(resolve(next, file), 'utf8'))), nextReviewed, 'Next apply equals every reviewed byte, including source-map configuration');
  const deploy = await request('/api/projects/setup/keys', 'POST', { kind: 'deploy' });
  const nextBin = resolve(next, 'node_modules/next/dist/bin/next'), env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CIRCLE_NODE_TOTAL: '2', NEXT_PUBLIC_SPOOL_RELEASE: 'synthetic-spool-setup-1', SPOOL_BUILD: 'synthetic-spool-1', NEXT_PUBLIC_SPOOL_BUILD: 'synthetic-spool-1', SPOOL_ENDPOINT: origin, SPOOL_PROJECT: 'setup', SPOOL_DEPLOY_KEY: deploy.key };
  stage('build Next.js before map upload');
  execFileSync(process.execPath, [nextBin, 'build', '--webpack'], { cwd: next, env, stdio: 'pipe' });
  const nextPort = 20000 + Math.floor(Math.random() * 20000), nextOrigin = `http://127.0.0.1:${nextPort}`;
  const startNext = async () => {
    stage('wait for Next.js readiness (30-second deadline)');
    nextServer = spawn(process.execPath, [nextBin, 'start', '-p', String(nextPort), '-H', '127.0.0.1'], { cwd: next, env, stdio: ['ignore', 'pipe', 'inherit'] });
    children.push(nextServer);
    const child = nextServer;
    await new Promise((done, fail) => {
      let output = '';
      const finish = error => {
        clearTimeout(timer);
        child.off('error', failed); child.off('exit', exited); child.stdout.off('data', ready);
        if (error) { child.kill(); fail(error); } else { child.stdout.resume(); done(); }
      };
      const failed = error => finish(error);
      const exited = (code, signal) => finish(new Error(`Next.js exited before readiness (code=${code}, signal=${signal})`));
      // Keep a bounded tail so a Ready line split across chunks still completes the wait.
      const ready = chunk => { output = (output + chunk).slice(-4096); if (/Ready/.test(output)) finish(); };
      const timer = setTimeout(() => finish(new Error('Next.js did not become Ready within 30 seconds')), 30_000);
      child.once('error', failed); child.once('exit', exited); child.stdout.on('data', ready);
    });
  };
  await startNext();
  await request('/api/projects/setup/browser-origins', 'POST', { origin: nextOrigin });
  const engine = FiltersEngine.parse(await readFile('tests/fixtures/adblock/easyprivacy-sentry.txt', 'utf8'));
  browser = await launchBrowser();
  const context = await browser.newContext(), page = await context.newPage(), blocked = [];
  await context.route('**/*', route => { const r = route.request(); const verdict = engine.match(AdRequest.fromRawDetails({ url: r.url(), sourceUrl: page.url() || nextOrigin, type: r.resourceType() === 'fetch' ? 'xmlhttprequest' : r.resourceType() })); if (verdict.match) { blocked.push(r.url()); return route.abort('blockedbyclient'); } return route.continue(); });
  const failure = async () => {
    await page.goto(nextOrigin); await page.waitForLoadState('networkidle');
    await Promise.all([page.waitForResponse(response => response.url() === nextOrigin + '/monitoring' && response.request().method() === 'POST'), page.getByRole('button').click()]);
    await arrives('next setup failure');
    const issue = (await issues()).find(row => row.title.includes('next setup failure'));
    return { issue, packet: await request('/api/projects/setup/issues/' + issue.id + '/packet') };
  };
  stage('capture and read unmapped Next.js failure');
  const before = await failure();
  assert.ok(before.packet.events.every(event => event.atAdmission.every(frame => frame.status !== 'mapped')), 'before upload the real production failure is unmapped');
  stage('read unmapped failure in Spool at desktop and phone widths');
  await readScreens(origin, cookie, [{ name: 'setup-before', path: '/projects/setup/issues/' + before.issue.id, check: page => page.locator('.missing-map').first().waitFor() }]);
  stage('stop Next.js before map upload (10-second shutdown grace)');
  const stopNext = async () => {
    const child = nextServer;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = new Promise(done => child.once('exit', done));
    // The browser context is deliberately kept for the post-upload comparison.
    // Do not wait forever for Next's graceful shutdown with its connections open.
    const timer = setTimeout(() => { stage('Next.js shutdown grace expired; killing fixture'); child.kill('SIGKILL'); }, 10_000);
    try { child.kill(); await stopped; } finally { clearTimeout(timer); }
  };
  await stopNext();
  stage('rebuild Next.js and upload maps');
  const built = await new Promise((done, fail) => {
    const child = spawn(process.execPath, ['--env-file=.env.local', 'spool-build.mjs'], { cwd: next, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
    child.once('error', fail); child.once('exit', code => done({ code, output }));
  });
  assert.equal(built.code, 0, built.output);
  await startNext();
  stage('capture and read mapped Next.js failure');
  const after = await failure();
  const mapped = after.packet.events.flatMap(event => event.atAdmission).find(frame => frame.status === 'mapped' && /app\/page\.js$/.test(frame.original.file));
  assert.ok(mapped, 'setup build uploads the application map used at admission');
  assert.equal(mapped.original.line, 2, 'real thrown error maps to original line');
  await readScreens(origin, cookie, [{ name: 'setup-mapped', path: '/projects/setup/issues/' + after.issue.id, check: page => page.getByText(/app\/page\.js:2:/).first().waitFor() }]);
  await context.close();
  assert.deepEqual(blocked, [], 'the configured app sends nothing the list blocks');
  console.log(JSON.stringify({ passed: true, proof: 'Packed spool-setup on fresh Django and Next.js apps: reviewable git-apply patch equals the applied change, SDK installed, test event accepted, configured apps report real failures; other frameworks get guidance; refused DSNs (bad, wrong key, redirect, not Spool, secret key, control characters), a link or hard link to a file outside the project, a link swapped in during the test event and a settings module that is not a dotted name write nothing.' }));
} finally {
  stage('cleanup browsers, servers and temporary apps');
  await browser?.close();
  for (const child of children) child.kill();
  elsewhere?.close(); hop?.close(); await worker?.stop(); await rm(temporary, { recursive: true, force: true });
}
