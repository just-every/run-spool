import json
from pathlib import Path
import subprocess

p=json.loads(Path('package.json').read_text())
s=json.loads(Path('seed.json').read_text())
r=json.loads(Path('RELEASE.json').read_text())
assert p['version']==s['version']==r['version']=='0.7.9'
assert r['previousVersion']=='0.7.8'
assert r['contractChanges']=={} and r['extensionPointChanges']==[]
assert r['migrations']==[] and r['breaking'] is False
assert p['devDependencies']['@runeditrun/rer']=='0.2.107'
old=json.loads(subprocess.check_output(['git','show','v0.7.8:package.json'],text=True))
assert p['dependencies']==old['dependencies'] and p['devDependencies']==old['devDependencies']
assert subprocess.check_output(['git','diff','--name-only','v0.7.8','HEAD','--','migrations'],text=True)==''
assert not Path('package-lock.json').exists()
changelog=Path('CHANGELOG.md').read_text()
notes=changelog.split('## 0.7.9 — 2026-11-13\n\n',1)[1].split('\n\n## 0.7.8 —',1)[0]
assert notes==r['publicReleaseNotes']
old_changelog=subprocess.check_output(['git','show','HEAD:CHANGELOG.md'],text=True)
assert changelog.endswith(old_changelog.removeprefix('# Changelog\n\n'))
for f in ['README.md','docs/getting-started.md']:
 assert 'v0.7.9' in Path(f).read_text() and 'v0.7.8' not in Path(f).read_text()
allowed={'package.json','seed.json','README.md','docs/getting-started.md','CHANGELOG.md','RELEASE.json','sources.lock.json'}
changed=set(subprocess.check_output(['git','diff','--name-only'],text=True).splitlines())
assert changed<=allowed, changed-allowed
assert not subprocess.check_output(['git','diff','--name-only','HEAD','--','CONTRACT.md','ACCEPTANCE.md','docs/CLAIMS.md','src','tests','pnpm-lock.yaml'],text=True)
print(json.dumps({'ok':True,'version_before':'0.7.8','version_after':'0.7.9','predecessor':'0.7.8','rer_pin':'0.2.107','new_migrations':0,'breaking':False,'contract_changes':0,'product_changes':0,'test_changes':0,'notes_match':True,'prior_changelog_preserved':True,'metadata_paths':sorted(changed)},indent=2))
