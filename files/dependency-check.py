"""Read committed package graphs and emit a non-secret dependency receipt."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import sys
import yaml

repo = Path(sys.argv[1]).resolve()
packet = Path(sys.argv[2]).resolve()

def git(*args):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=True).strip()

def data_at(ref, name):
    return git('show', ref + ':' + name)

head = git('rev-parse', 'HEAD')
main = git('rev-parse', 'origin/main')
remote = git('ls-remote', '--symref', 'origin', 'HEAD', 'refs/heads/main')
assert head == main
assert 'ref: refs/heads/main\tHEAD' in remote
assert f'{head}\trefs/heads/main' in remote
assert git('status', '--porcelain') == ''
fix = 'f773e85edf527a1e790f763a6da9a91c71aa8f73'
subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', fix, head], check=True)

contexts = []
for prefix in ('', 'src/modules/mail/'):
    manifest_path = prefix + 'package.json'
    lock_path = prefix + 'pnpm-lock.yaml'
    manifest = json.loads(data_at(head, manifest_path))
    lock_text = data_at(head, lock_path)
    lock = yaml.safe_load(lock_text)
    versions = sorted(k for k in lock['packages'] if re.match(r'^undici@', k))
    snapshots = sorted(k for k in lock['snapshots'] if re.match(r'^undici@', k))
    assert manifest['pnpm']['overrides']['undici'] == lock['overrides']['undici'] == '7.30.1'
    assert versions == snapshots == ['undici@7.30.1']
    edges = []
    for name, snapshot in lock['snapshots'].items():
        for section in ('dependencies', 'optionalDependencies'):
            if 'undici' in snapshot.get(section, {}):
                target = str(snapshot[section]['undici'])
                assert target == '7.30.1', (name, target)
                edges.append({'parent': name, 'section': section, 'undici': target})
    assert edges
    paths = []
    for importer_name, importer in lock['importers'].items():
        for section in ('dependencies', 'devDependencies', 'optionalDependencies'):
            for name, spec in importer.get(section, {}).items():
                version = str(spec['version'])
                if version.startswith(('link:', 'file:')):
                    continue
                if version.startswith('/'):
                    version = version[1:]
                if version.startswith('npm:'):
                    version = version[4:]
                    start = version
                else:
                    start = name + '@' + version
                def walk(node, seen, chain):
                    if node in seen:
                        return
                    if node.startswith('undici@'):
                        paths.append({'importer': importer_name, 'section': section, 'path': chain})
                        return
                    snapshot = lock['snapshots'].get(node, {})
                    for kind in ('dependencies', 'optionalDependencies'):
                        for dep, value in snapshot.get(kind, {}).items():
                            value = str(value)
                            if value.startswith(('link:', 'file:')):
                                continue
                            child = value[4:] if value.startswith('npm:') else dep + '@' + value
                            walk(child, seen | {node}, chain + [child])
                walk(start, set(), [start])
    previous = yaml.safe_load(data_at(fix + '^', lock_path))
    prior_versions = sorted(k for k in previous['packages'] if re.match(r'^undici@', k))
    vulnerable_before = [k for k in prior_versions if (7, 0, 0) <= tuple(map(int, k.split('@')[1].split('.'))) < (7, 30, 1)]
    vulnerable_now = [k for k in versions if (7, 0, 0) <= tuple(map(int, k.split('@')[1].split('.'))) < (7, 30, 1)]
    assert not vulnerable_now
    contexts.append({
        'manifest': manifest_path, 'lockfile': lock_path,
        'manifest_blob': git('rev-parse', head + ':' + manifest_path),
        'lockfile_blob': git('rev-parse', head + ':' + lock_path),
        'lockfile_sha256': hashlib.sha256(subprocess.check_output(['git', '-C', str(repo), 'show', head + ':' + lock_path])).hexdigest(),
        'override': manifest['pnpm']['overrides']['undici'],
        'package_versions': versions, 'snapshot_versions': snapshots,
        'incoming_edges': edges, 'importer_paths': paths,
        'historical_pre_fix_versions': prior_versions,
        'historical_pre_fix_vulnerable_versions': vulnerable_before,
        'current_vulnerable_versions': vulnerable_now,
        'undici_engine': lock['packages']['undici@7.30.1']['engines']['node'],
        'assertions': 'PASS',
    })
receipt = {
    'schema': 1, 'author': 'Run Edit Run fleet',
    'timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'repository': 'just-every/run-spool', 'branch': git('branch', '--show-current'),
    'head': head, 'origin_main': main, 'remote_default_probe': remote.splitlines(),
    'existing_fix': fix, 'existing_fix_is_ancestor': True,
    'affected_range_from_brief': '>=7.0.0 <7.30.1',
    'advisories': ['GHSA-4w7w-5xrc-9h26','GHSA-2m5v-pch6-74hx','GHSA-qrxm-fqhp-jwvm','GHSA-9fm3-97px-rjf6'],
    'contexts': contexts, 'worktree_clean': True,
    'candidate_commits': git('rev-list', '--count', 'origin/main..HEAD'),
    'conclusion': 'no-change: the current remote default branch already resolves every undici edge to 7.30.1',
    'runtime_tests': 'NOT RUN: no product changes or installed dependencies; this is committed-graph verification, not an exploit reproduction or runtime qualification',
}
(packet / 'dependency-receipt.json').write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
print(json.dumps(receipt, indent=2, sort_keys=True))
