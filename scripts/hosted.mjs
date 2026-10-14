#!/usr/bin/env node
// Owner steps for a Spool deployed with `rer deploy` (docs/HOSTED.md).
// rer 0.2.4 claims or preserves the hosted owner and retires SETUP_TOKEN.
// This check confirms /health serves this checkout's commit, using the origin
// from .rer/deploy/<environment>.json.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const fail = message => { console.error(`hosted: ${message}`); process.exit(1); };
let parsed;
try { parsed = parseArgs({ allowPositionals: true, strict: true, options: { environment: { type: 'string', default: 'production' } } }); }
catch { fail('usage: node scripts/hosted.mjs check [--environment <name>]'); }
const { positionals: [command], values: { environment } } = parsed;
if (command !== 'check' || parsed.positionals.length !== 1) fail('usage: node scripts/hosted.mjs check [--environment <name>]');
if (!/^[a-z][a-z0-9-]{0,39}$/.test(environment)) fail('the environment name is not valid.');

let origin;
try { origin = JSON.parse(await readFile(resolve('.rer/deploy', `${environment}.json`), 'utf8')).receipt?.origin; } catch {}
if (typeof origin !== 'string' || !/^https:\/\/[a-z0-9.-]+$/.test(origin)) fail(`no completed deploy of ${environment} is recorded in .rer/deploy. Run rer deploy --environment ${environment} first.`);

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let health;
try { health = await (await fetch(new URL('/health', origin), { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } })).json(); } catch { fail(`${origin}/health did not answer.`); }
const source = health?.deployment?.sourceSha;
if (health?.ok !== true || source !== head) fail(`${origin} runs ${source ?? 'an unknown commit'}, not this checkout's ${head}.`);
console.log(`${origin} runs ${head}, this checkout's commit (version ${health.deployment.versionId ?? 'unknown'}).`);
