import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

// The released, unmodified sentry-cli from the @sentry/cli package. Only the Sentry URL, organization and
// project slugs and the auth token are set, as a team's existing CI would set them.
export const cliPath = resolve('node_modules/.bin/sentry-cli');
export function runCli(args, {origin, token, project = 'web', org = 'acme', cwd = process.cwd(), env = {}, timeout = 120000} = {}) {
 return new Promise(resolveRun => {
  const child = spawn(cliPath, args, {cwd, env: {...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', SENTRY_URL: origin, SENTRY_AUTH_TOKEN: token, SENTRY_ORG: org, SENTRY_PROJECT: project, SENTRY_DISABLE_TELEMETRY: '1', ...env}, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => output += chunk);
  child.on('close', code => { clearTimeout(timer); resolveRun({code, output}); });
 });
}
