import {spawnSync} from 'node:child_process';

const suites = ['product-tools','sdk','delivery','evidence','project-erasure','identity-import','runtimes-a','runtimes-b','commands'];
const requested = process.env.SPOOL_VERIFY_SUITES?.split(',');
if(requested?.some(name=>!suites.includes(name)))throw Error('Unknown SPOOL_VERIFY_SUITES selection');
// Full runtime qualification belongs to CI; the public Node-only installation
// keeps its application/command verification, as before. Explicit selection can
// run the additional SDK toolchains on a qualified development machine.
const selected=requested??suites.filter(name=>!name.startsWith('runtimes-'));
const commands = [
 ['pnpm', ['run', 'check', '--', '--profile', 'first-party']],
 ['pnpm', ['source:check']],
 [process.execPath, ['scripts/edition-authoring/cli.mjs', 'verify-base', '--offline']],
 ['pnpm', ['run', 'build:app']],
 ['pnpm', ['integration:check']],
 ['pnpm', ['typecheck']],
 ...selected.map(name => [process.execPath, [name==='commands'?'tests/commands.mjs':'tests/journeys.mjs',...(name==='commands'?[]:[name])]]),
];
for (const [command, args] of commands) {
 const result = spawnSync(command, args, {stdio:'inherit', env:process.env});
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Spool verification passed: ${requested ? selected.join(', ') : 'all application and installation journeys'}`);
