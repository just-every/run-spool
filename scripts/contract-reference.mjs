// Contract prose checks read the recorded pre-conversion source. CI checks out
// one commit, so obtain that exact source without changing checkout or branch.
import {readFileSync, existsSync, realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const map = 'docs/contract/COVERAGE.json';
if (existsSync(map)) {
  const revision = JSON.parse(readFileSync(map, 'utf8')).old?.commit;
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw Error('Invalid contract source revision');
  const git = args => spawnSync('git', args, {stdio: 'pipe', timeout: 180000});
  const checkout = git(['rev-parse', '--show-toplevel']);
  // Installed source trees have no repository history to prepare. Do not use
  // an unrelated enclosing checkout's origin either.
  if (checkout.status !== 0 || realpathSync(checkout.stdout.toString().trim()) !== realpathSync('.')) process.exit(0);
  if (git(['cat-file', '-e', `${revision}^{commit}`]).status !== 0) {
    const result = spawnSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', revision], {stdio: 'inherit', timeout: 180000});
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Cannot obtain the recorded contract source from origin');
    if (git(['cat-file', '-e', `${revision}^{commit}`]).status !== 0) throw Error('Recorded contract source is unavailable after fetch');
  }
}
