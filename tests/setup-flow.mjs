// The guided setup command, as a user gets it: the packed `spool-setup` bin run on fresh Django and Next.js apps.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { FiltersEngine, Request as AdRequest } from '@ghostery/adblocker';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';

const wait = ms => new Promise(done => setTimeout(done, ms));
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-setup-')), tool = resolve(temporary, 'tool');
let worker, browser, server, nextServer;
const children = [];
try {
  await mkdir(tool);
  const packed = JSON.parse(execFileSync(process.execPath, ['packages/sdk/build.mjs', '--pack'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  await writeFile(resolve(tool, 'package.json'), JSON.stringify({ name: 'tool', private: true, type: 'module' }));
  execFileSync('npm', ['install', packed.tarball, '--offline', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: tool, stdio: 'ignore' });
  const bin = resolve(tool, 'node_modules/@just-every/spool/dist/setup.js');
  const wizard = (args, options = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', ...options });
  worker = await startTestWorker(15572); const { origin } = worker, cookie = await signIn(origin);
  const request = async (path, method = 'GET', body) => { const response = await fetch(origin + path, { method, headers: { Origin: origin, Cookie: cookie, ...body ? { 'Content-Type': 'application/json' } : {} }, ...body ? { body: JSON.stringify(body) } : {} }); assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`); return response.json(); };
  const project = await request('/api/projects', 'POST', { id: 'setup', name: 'Guided setup' });
  const issues = () => request('/api/projects/setup/issues');
  const arrives = async text => { for (let attempt = 0; attempt < 150; attempt++) { if ((await issues()).some(issue => issue.title.includes(text))) return; await wait(100); } assert.fail(`${text} never arrived`); };
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=synthetic-spool@example.test', '-c', 'user.name=synthetic-spool', ...args], { cwd, encoding: 'utf8' });

  // Refusals first: a malformed DSN, an unsupported framework, and a DSN Spool does not know.
  assert.equal(wizard(['--dsn', 'not-a-dsn']).status, 1);
  const rails = resolve(temporary, 'rails-app'); await mkdir(rails); await writeFile(resolve(rails, 'Gemfile'), "source 'https://rubygems.org'\ngem 'rails'\n");
  const guided = wizard(['--dsn', project.dsn, '--dir', rails, '--no-test-event']);
  assert.equal(guided.status, 0); assert.match(guided.stdout, /Detected rails/); assert.match(guided.stdout, /sentry-rails/); assert.ok(!guided.stdout.includes('diff --git'), 'frameworks without a generator get guidance, not a patch');
  const forged = project.dsn.replace(/\/\/./, m => '//' + (project.dsn[7] === '0' ? '1' : '0'));
  const refused = wizard(['--dsn', forged, '--dir', rails]);
  assert.equal(refused.status, 1); assert.match(refused.stdout, /refused the test event \(HTTP 401\)/);

  // Django: a fresh project, a reviewable patch first, then the same change applied with the SDK installed.
  const django = resolve(temporary, 'django-app'); await mkdir(django);
  execFileSync('python3', ['-m', 'venv', resolve(temporary, 'venv')]);
  const python = resolve(temporary, 'venv/bin/python');
  execFileSync(python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', 'django==5.2.8'], { stdio: 'inherit' });
  execFileSync(python, ['-m', 'django', 'startproject', 'shop', '.'], { cwd: django });
  await writeFile(resolve(django, 'requirements.txt'), 'django==5.2.8\n');
  git(django, 'init', '-q'); git(django, 'add', '-A'); git(django, 'commit', '-q', '-m', 'fresh app');
  const dry = wizard(['--dsn', project.dsn, '--dir', django, '--no-test-event', '--python', python]);
  assert.equal(dry.status, 0, dry.stderr); assert.match(dry.stdout, /Detected django/); assert.match(dry.stdout, /diff --git a\/shop\/settings\.py/); assert.match(dry.stdout, /Nothing written/);
  assert.equal(git(django, 'status', '--porcelain'), '', 'the dry run changes nothing');
  const patch = dry.stdout.slice(dry.stdout.indexOf('diff --git')).split('\nRun:')[0] + '\n';
  await writeFile(resolve(temporary, 'django.patch'), patch);
  git(django, 'apply', '--check', resolve(temporary, 'django.patch'));
  git(django, 'apply', resolve(temporary, 'django.patch'));
  const reviewed = { settings: await readFile(resolve(django, 'shop/settings.py'), 'utf8'), env: await readFile(resolve(django, '.env'), 'utf8'), requirements: await readFile(resolve(django, 'requirements.txt'), 'utf8') };
  git(django, 'checkout', '-q', '.'); git(django, 'clean', '-fdq');
  const applied = wizard(['--dsn', project.dsn, '--dir', django, '--apply', '--install', '--python', python], { stdio: ['ignore', 'pipe', 'inherit'] });
  assert.equal(applied.status, 0); assert.match(applied.stdout, /Test event [0-9a-f]{32} accepted by Spool/);
  assert.equal(await readFile(resolve(django, 'shop/settings.py'), 'utf8'), reviewed.settings, 'applying the change writes exactly the reviewed patch');
  assert.equal(await readFile(resolve(django, '.env'), 'utf8'), reviewed.env); assert.equal(await readFile(resolve(django, 'requirements.txt'), 'utf8'), reviewed.requirements);
  execFileSync(python, ['-c', 'import sentry_sdk'], { stdio: 'ignore' });
  const again = wizard(['--dsn', project.dsn, '--dir', django, '--apply', '--no-test-event']);
  assert.match(again.stdout, /already configured/); assert.equal((await readFile(resolve(django, 'shop/settings.py'), 'utf8')), reviewed.settings, 'setup is idempotent');
  await arrives('Spool setup test event');
  // The configured app reports a real request failure through the Django integration, with no further setup.
  await writeFile(resolve(django, 'shop/urls.py'), "from django.urls import path\n\ndef boom(request):\n    raise RuntimeError('django setup failure')\n\nurlpatterns = [path('boom', boom)]\n");
  const djangoPort = 20000 + Math.floor(Math.random() * 20000);
  const runserver = spawn(python, ['manage.py', 'runserver', '--noreload', `127.0.0.1:${djangoPort}`], { cwd: django, env: { ...process.env, SPOOL_DSN: project.dsn, DEBUG: '' }, stdio: 'ignore' });
  children.push(runserver);
  for (let attempt = 0; attempt < 100; attempt++) { try { await fetch(`http://127.0.0.1:${djangoPort}/boom`); break; } catch { await wait(200); } }
  await arrives('RuntimeError: django setup failure');

  // Next.js: a fresh app configured by the command, then built and served, with the EasyPrivacy Sentry rules enforced.
  const next = resolve(temporary, 'next-app'); await mkdir(resolve(next, 'app'), { recursive: true });
  await writeFile(resolve(next, 'package.json'), JSON.stringify({ name: 'fresh-next', private: true, type: 'module', dependencies: { next: '16.4.2', react: '19.2.8', 'react-dom': '19.2.8' } }));
  await writeFile(resolve(next, 'app/layout.js'), 'export default function Layout({ children }) { return <html lang="en"><body>{children}</body></html>; }\n');
  await writeFile(resolve(next, 'app/page.js'), "'use client';\nexport default function Page() { return <button onClick={() => { throw new Error('next setup failure'); }}>Throw</button>; }\n");
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: next, stdio: 'ignore' });
  const nextRun = wizard(['--dsn', project.dsn, '--dir', next, '--apply', '--install', '--spool-package', packed.tarball, '--no-test-event'], { stdio: ['ignore', 'pipe', 'inherit'] });
  assert.equal(nextRun.status, 0); assert.match(nextRun.stdout, /Detected next/); assert.match(nextRun.stdout, /tunnelRoute/);
  for (const file of ['app/monitoring/route.js', 'instrumentation-client.js', '.env.local']) assert.ok((await readFile(resolve(next, file), 'utf8')).length > 0, file);
  const nextBin = resolve(next, 'node_modules/next/dist/bin/next'), env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  execFileSync(process.execPath, [nextBin, 'build'], { cwd: next, env, stdio: 'pipe' });
  const nextPort = 20000 + Math.floor(Math.random() * 20000), nextOrigin = `http://127.0.0.1:${nextPort}`;
  nextServer = spawn(process.execPath, [nextBin, 'start', '-p', String(nextPort), '-H', '127.0.0.1'], { cwd: next, env, stdio: ['ignore', 'pipe', 'inherit'] });
  children.push(nextServer);
  await new Promise((done, fail) => { nextServer.once('error', fail); nextServer.stdout.on('data', chunk => { if (/Ready/.test(String(chunk))) done(); }); });
  await request('/api/projects/setup/browser-origins', 'POST', { origin: nextOrigin });
  const engine = FiltersEngine.parse(await readFile('tests/fixtures/adblock/easyprivacy-sentry.txt', 'utf8'));
  browser = await launchBrowser();
  const context = await browser.newContext(), page = await context.newPage(), blocked = [];
  await context.route('**/*', route => { const r = route.request(); const verdict = engine.match(AdRequest.fromRawDetails({ url: r.url(), sourceUrl: page.url() || nextOrigin, type: r.resourceType() === 'fetch' ? 'xmlhttprequest' : r.resourceType() })); if (verdict.match) { blocked.push(r.url()); return route.abort('blockedbyclient'); } return route.continue(); });
  await page.goto(nextOrigin); await page.getByRole('button').click(); await context.close();
  await arrives('next setup failure');
  assert.deepEqual(blocked, [], 'the configured app sends nothing the list blocks');
  console.log(JSON.stringify({ passed: true, proof: 'Packed spool-setup on fresh Django and Next.js apps: reviewable git-apply patch equals the applied change, SDK installed, test event accepted, configured apps report real failures; other frameworks get guidance; bad DSNs refused.' }));
} finally {
  await browser?.close();
  for (const child of children) child.kill();
  await worker?.stop(); await rm(temporary, { recursive: true, force: true });
}
