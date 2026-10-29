import {spawnSync} from 'node:child_process';

const suites = [
 'agent-door', 'runtime', 'product', 'origins', 'accessibility', 'alerts', 'alerts-ui',
 'sentry', 'sentry:sdk', 'sdk', 'admission', 'dev-credentials', 'commands',
 'agent-handoff', 'privacy', 'repair-recovery', 'execution', 'project-erasure',
 'project-erasure-cap', 'owner-erasure', 'languages',
];
const requested = process.env.SPOOL_VERIFY_SUITES?.split(',');
if (requested?.some(name => !suites.includes(name))) throw Error('Unknown SPOOL_VERIFY_SUITES selection');
const selected = requested ? suites.filter(name => requested.includes(name)) : suites;
const commands = [
 ['pnpm', ['run', 'check', '--', '--profile', 'first-party']],
 ['pnpm', ['source:check']],
 [process.execPath, ['scripts/edition-authoring/cli.mjs', 'verify-base', '--offline']],
 ['pnpm', ['run', 'build:app']],
 ['pnpm', ['integration:check']],
 [process.execPath,['scripts/agent-door/surface.mjs','--check']],
 ['pnpm', ['typecheck']],
 ...selected.map(name => ['pnpm', ['run', `test:${name}`]]),
];
for (const [command, args] of commands) {
 const result = spawnSync(command, args, {stdio:'inherit', env:process.env});
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Spool verification passed: ${requested ? selected.join(', ') : 'all application and installation journeys'}`);
