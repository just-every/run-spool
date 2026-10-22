#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { detect } from './detect.mjs';
import { sendTestEvent } from './event.mjs';
import { planChanges, projectRoot, writeChanges } from './files.mjs';
import { patchOf } from './patch.mjs';
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
  options.dsn = publicDsn(options.dsn);
  return options;
}

// The DSN is checked before anything is printed or written, and only its canonical public form is ever used.
function publicDsn(value) {
  // URL parsing drops tabs and newlines silently; refused here so they can never reach a written file.
  if (/[\u0000-\u0020\u007f]/.test(value ?? '')) throw new Error(`--dsn must not contain spaces or control characters\n${usage}`);
  const url = (() => { try { return new URL(value); } catch { return undefined; } })();
  if (url?.password) throw new Error('--dsn carries a secret key. Use the project\'s public DSN (key@host/number); the secret was not printed or written.');
  if (!url || !['http:', 'https:'].includes(url.protocol) || !url.username || url.search || url.hash || !/^[1-9][0-9]{0,15}$/.test(url.pathname.slice(1))) throw new Error(`--dsn must be a Spool project DSN (key@host/number)\n${usage}`);
  return `${url.protocol}//${url.username}@${url.host}${url.pathname}`;
}

export async function setup(args, out = console.log) {
  const options = parse(args), root = projectRoot(options.dir), found = await detect(root.path), steps = plan(found, options);
  out(`Detected ${found.framework}.`);
  // Read now, and checked again when written: links, shared hard links and odd paths stop the command here.
  const changes = planChanges(root, steps.files);
  // The test event goes first: a DSN Spool does not accept leaves the app untouched.
  if (!options.noTestEvent) {
    const result = await sendTestEvent(options.dsn);
    if (!result.accepted) {
      out(`${result.status === 200 ? 'The DSN host did not answer as Spool' : 'Spool refused the test event'} (HTTP ${result.status}): ${result.body.slice(0, 200).replace(/[\u0000-\u001f\u007f]/g, ' ')}`);
      throw new Error('test event not accepted; nothing written');
    }
    out(`Test event ${result.eventId} accepted by Spool.`);
  }
  for (const change of changes) if (change.kind === 'present') out(`${change.path}: already configured`); else if (change.kind === 'exists') out(`${change.path}: exists and differs; merge by hand`);
  const patch = patchOf(changes);
  if (patch) out(patch.trimEnd());
  for (const install of steps.installs) out(`${options.install ? 'Running' : 'Run'}: ${install.command} ${install.args.join(' ')}`);
  if (options.apply) { writeChanges(root, changes); out(`Wrote ${changes.filter(change => ['create', 'append'].includes(change.kind)).length} file(s).`); } else if (patch) out('Nothing written; rerun with --apply to write this patch.');
  if (options.install) for (const install of steps.installs) { const result = spawnSync(install.command, install.args, { cwd: root.path, stdio: 'inherit' }); if (result.status !== 0) throw new Error(`${install.command} failed`); }
  for (const note of steps.notes) out(`Note: ${note}`);
  return { framework: found.framework, changes: changes.map(({ path, kind }) => ({ path, kind })) };
}

setup(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
