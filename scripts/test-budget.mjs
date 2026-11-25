// Counted test cap (owner, 15 Oct 2026: "a per-seed cap, not a hard cap. Default to 200"; raised only with a
// written reason in test-budget.json). One count per test registration: every distinct tests/ script that
// package.json, verification.json or a workflow runs, and every SDK runtime in Verify's runtime matrix.
// A journey folded into an existing script is not counted, so a new test file only has to be registered to count.
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const budget = JSON.parse(read('test-budget.json'));
const sources = [
  ...Object.values(JSON.parse(read('package.json')).scripts ?? {}),
  JSON.stringify(JSON.parse(read('verification.json'))),
  ...readdirSync('.github/workflows').filter(name => /\.ya?ml$/.test(name)).map(name => read(`.github/workflows/${name}`)),
];
const registrations = new Set();
for (const source of sources) {
  for (const [path] of source.matchAll(/\btests\/[\w./-]+\.(?:mjs|cjs|js|ts)\b/g)) if (existsSync(path)) registrations.add(path);
  for (const [, list] of source.matchAll(/\bruntime:\s*\[([^\]]+)\]/g)) {
    for (const name of list.split(',')) registrations.add(`tests/sdk-runtimes.mjs ${name.trim()}`);
  }
}
const count = registrations.size;
if (!Number.isInteger(budget.cap) || budget.cap < 1) throw Error('test-budget.json needs an integer cap');
if (budget.cap > 200 && !String(budget.reason ?? '').trim()) throw Error('A cap above the default 200 needs a written reason in test-budget.json');
console.log(`Test registrations: ${count} of cap ${budget.cap}`);
if (count > budget.cap) {
  console.error([...registrations].sort().join('\n'));
  console.error(`Over the cap by ${count - budget.cap}: delete tests, or raise the cap in test-budget.json with a written reason.`);
  process.exit(1);
}
