"""Read-only maintenance receipt. Run Edit Run fleet, 2026-11-17."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import yaml

repo = Path(sys.argv[1]).resolve()
packet = Path(__file__).resolve().parent
fix = 'e206a1ca9a631059818333837062a90bd225443d'
def git(*args):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=True).strip()
sha = git('rev-parse', 'HEAD')
main = git('rev-parse', 'origin/main')
assert sha == main, 'checkout must match origin/main'
assert not git('status', '--porcelain'), 'checkout must be clean'
assert not git('diff', '--name-only', 'origin/main', 'HEAD')
assert not git('log', 'origin/main..HEAD', '--format=%H')
subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', fix, main], check=True)
remote = git('ls-remote', '--symref', 'origin', 'HEAD', 'refs/heads/main')
assert 'ref: refs/heads/main\tHEAD' in remote
assert f'{sha}\trefs/heads/main' in remote, 'main moved; verify fresh tree'
version = lambda value: tuple(int(x) for x in re.match(r'^(\d+)\.(\d+)\.(\d+)', value).groups())
affected = lambda value: (8, 2, 0) <= version(value) <= (8, 2, 3)
manifest = json.loads((repo / 'package.json').read_text())
declared = manifest['devDependencies']['vite']
assert version(declared) >= (8, 2, 4)
locks = []
for path in sorted(repo.rglob('pnpm-lock.yaml')):
    if '.git' in path.parts or 'node_modules' in path.parts:
        continue
    data = yaml.safe_load(path.read_text())
    package_versions = [key[5:] for key in data.get('packages', {}) if key.startswith('vite@')]
    snapshot_versions = [key[5:] for key in data.get('snapshots', {}) if key.startswith('vite@')]
    assert all(not affected(value) for value in package_versions + snapshot_versions)
    assert all(version(value) >= (8, 2, 4) for value in package_versions + snapshot_versions)
    if path == repo / 'pnpm-lock.yaml':
        importer = data['importers']['.']['devDependencies']['vite']
        assert importer['specifier'] == declared
        assert version(importer['version']) == version(declared)
        assert len(package_versions) == len(snapshot_versions) == 1
    locks.append({'path':str(path.relative_to(repo)), 'package_versions': package_versions,
                  'snapshot_versions':snapshot_versions,
                  'affected_resolutions':sum(affected(value) for value in package_versions),
                  'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
prior = yaml.safe_load(git('show', fix + '^:pnpm-lock.yaml'))
prior_versions = [key[5:] for key in prior['packages'] if key.startswith('vite@')]
assert any(affected(value) for value in prior_versions)
ci = json.loads((packet / 'ci-runs.json').read_text())
verify = [run for run in ci['workflow_runs'] if run['name'] == 'Verify' and run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == sha]
assert verify, 'no exact-main success receipt'
receipt = dict(author='Run Edit Run fleet', recorded_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    repository='just-every/run-spool', branch=git('branch','--show-current'), head=sha, origin_main=main,
    default_ref_probe=remote.splitlines(), status='no-change', advisory='GHSA-698v-4r3x-3vcv',
    related_alerts=[20,18], declared_vite=declared, original_fix=fix, original_fix_is_main_ancestor=True,
    original_fix_before_vite=prior_versions, original_fix_affected_before=sum(affected(v) for v in prior_versions),
    original_fix_affected_after=0, current_affected_before=0, current_affected_after=0,
    lockfiles=locks, local_product_changed_files=[], new_product_commits=0,
    contract_clause_changes=[], exact_main_successful_verify=verify,
    tests_added=0, tests_removed=0, github_api_calls=1,
    local_install_build_typecheck='not run: no product changes; exact-main completed successful Verify recorded',
    product_publication_scan='not run: no product changes, commits or push; evidence uses the dedicated report-only entrypoint')
(packet / 'verification-receipt.json').write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
print(json.dumps(receipt, indent=2, sort_keys=True))
