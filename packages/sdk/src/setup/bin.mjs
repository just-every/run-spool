#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { detect } from './detect.mjs';
import { sendTestEvent } from './event.mjs';
import { patchOf, resolveChange, writeChanges } from './patch.mjs';
import { plan } from './plans.mjs';

const usage = 'Usage: spool-setup --dsn DSN [--dir DIR] [--apply] [--install] [--no-test-event] [--python PYTHON] [--spool-package SPEC]\n  Without --apply it prints the change as a patch and writes nothing.';
function parse(args) {
  const options = { dir: '.' }, values = new Map([['--dsn', 'dsn'], ['--dir', 'dir'], ['--python', 'python'], ['--spool-package', 'spoolPackage']]), flags = new Map([['--apply', 'apply'], ['--install', 'install'], ['--no-test-event', 'noTestEvent']]);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (values.has(arg)) { if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${arg} needs a value\n${usage}`); options[values.get(arg)] = args[++index]; }
    else if (flags.has(arg)) options[flags.get(arg)] = true;
    else throw new Error(`Unknown option ${arg}\n${usage}`);
  }
  const url = (() => { try { return new URL(options.dsn); } catch { return undefined; } })();
  if (!url || !['http:', 'https:'].includes(url.protocol) || !url.username || !/^[1-9][0-9]{0,15}$/.test(url.pathname.slice(1))) throw new Error(`--dsn must be a Spool project DSN (key@host/number)\n${usage}`);
  return options;
}

export async function setup(args, out = console.log) {
  const options = parse(args), dir = resolve(options.dir), found = await detect(dir), steps = plan(found, options);
  out(`Detected ${found.framework}.`);
  const changes = [];
  for (const file of steps.files) changes.push(await resolveChange(dir, file));
  for (const change of changes) if (change.kind === 'present') out(`${change.path}: already configured`); else if (change.kind === 'exists') out(`${change.path}: exists and differs; merge by hand`);
  const patch = patchOf(changes);
  if (patch) out(patch.trimEnd());
  for (const install of steps.installs) out(`${options.install ? 'Running' : 'Run'}: ${install.command} ${install.args.join(' ')}`);
  if (options.apply) { await writeChanges(dir, changes); out(`Wrote ${changes.filter(change => ['create', 'append'].includes(change.kind)).length} file(s).`); } else if (patch) out('Nothing written; rerun with --apply to write this patch.');
  if (options.install) for (const install of steps.installs) { const result = spawnSync(install.command, install.args, { cwd: dir, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`${install.command} failed`); }
  for (const note of steps.notes) out(`Note: ${note}`);
  if (!options.noTestEvent) {
    const result = await sendTestEvent(options.dsn);
    out(result.status === 200 ? `Test event ${result.eventId} accepted by Spool.` : `Spool refused the test event (HTTP ${result.status}): ${result.body.slice(0, 200)}`);
    if (result.status !== 200) throw new Error('test event refused');
  }
  return { framework: found.framework, changes: changes.map(({ path, kind }) => ({ path, kind })) };
}

setup(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
