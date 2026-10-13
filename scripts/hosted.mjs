#!/usr/bin/env node
// Owner steps for a Spool deployed with `rer deploy` (docs/HOSTED.md).
//   claim  makes OWNER_EMAIL the hosted first owner. The pinned rer (0.2.1)
//          deploys without claiming it, so this sends the deployed one-time
//          SETUP_TOKEN to operator-auth's /auth/bootstrap. A claimed
//          installation keeps its owner and is reported as kept.
//   check  confirms the hosted app answers /health from this checkout's commit.
// Both read the origin from the deploy record .rer/deploy/<environment>.json.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const fail = message => { console.error(`hosted: ${message}`); process.exit(1); };
let parsed;
try { parsed = parseArgs({ allowPositionals: true, strict: true, options: { environment: { type: 'string', default: 'production' } } }); }
catch { fail('usage: node scripts/hosted.mjs claim|check [--environment <name>]'); }
const { positionals: [command], values: { environment } } = parsed;
if (!['claim', 'check'].includes(command) || parsed.positionals.length !== 1) fail('usage: node scripts/hosted.mjs claim|check [--environment <name>]');
if (!/^[a-z][a-z0-9-]{0,39}$/.test(environment)) fail('the environment name is not valid.');

let origin;
try { origin = JSON.parse(await readFile(resolve('.rer/deploy', `${environment}.json`), 'utf8')).receipt?.origin; } catch {}
if (typeof origin !== 'string' || !/^https:\/\/[a-z0-9.-]+$/.test(origin)) fail(`no completed deploy of ${environment} is recorded in .rer/deploy. Run rer deploy --environment ${environment} first.`);

if (command === 'claim') {
 const token = process.env.SETUP_TOKEN;
 if (!token?.trim()) fail('SETUP_TOKEN is not set. Load the same environment file you deployed with.');
 let response, code;
 // The edge can answer briefly from the previous Worker version after a deploy.
 for (let attempt = 1; ; attempt++) {
  try {
   response = await fetch(new URL('/auth/bootstrap', origin), { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, displayName: 'Owner', returnTo: '/' }) });
  } catch { fail(`${origin} did not answer.`); }
  code = response.status === 303 ? undefined : (await response.json().catch(() => null))?.error;
  if (response.status !== 403 || code !== 'invalid_setup_token' || attempt === 3) break;
  await new Promise(done => setTimeout(done, 5000));
 }
 if (response.status === 303) console.log(`Owner claimed. Sign in at ${origin}/sign-in with the OWNER_EMAIL you deployed.`);
 else if (response.status === 409 && code === 'already_initialized') console.log(`Owner already claimed and kept. Sign in at ${origin}/sign-in.`);
 else fail(`the claim was refused: HTTP ${response.status}${typeof code === 'string' && /^[a-z_]{1,64}$/.test(code) ? ` (${code})` : ''}.${code === 'invalid_setup_token' ? ' SETUP_TOKEN is not the deployed setup token.' : ''}`);
} else {
 const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
 let health;
 try { health = await (await fetch(new URL('/health', origin), { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } })).json(); } catch { fail(`${origin}/health did not answer.`); }
 const source = health?.deployment?.sourceSha;
 if (health?.ok !== true || source !== head) fail(`${origin} runs ${source ?? 'an unknown commit'}, not this checkout's ${head}.`);
 console.log(`${origin} runs ${head}, this checkout's commit (version ${health.deployment.versionId ?? 'unknown'}).`);
}
