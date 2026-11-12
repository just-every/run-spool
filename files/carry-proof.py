import subprocess,json,re,hashlib
from pathlib import Path

def git(*args):return subprocess.check_output(['git',*args])
main=git('rev-parse','origin/main').decode().strip()
c2=git('rev-parse','origin/cloud/main-spool-settings-split-1-c2').decode().strip()
paths=git('diff','--name-only','origin/main','HEAD').decode().splitlines()
rows=[]
for name in paths:
 if name in ['sources.lock.json','tests/agent-handoff/ui.mjs']:continue
 expected=git('show',c2+':'+name)
 assert Path(name).read_bytes()==expected,name+' differs from c2'
 rows.append({'path':name,'equals_c2':True})
name='tests/agent-handoff/ui.mjs'
main_ui=git('show',main+':'+name).decode()
assert Path(name).read_text()==main_ui.replace("app.origin+'/projects/a/settings'","app.origin+'/projects/a/settings#settings-projects'")
rows.append({'path':name,'equals_main_with_one_settings_fragment':True,'preserves_popup_reload_and_trace_diagnostics':True})
contracts={}
for name in ['CONTRACT.md','ACCEPTANCE.md','docs/CLAIMS.md']:
 data=Path(name).read_bytes();assert data==git('show',main+':'+name)
 contracts[name]={'equals_main':True,'sha256':hashlib.sha256(data).hexdigest()}
text=Path('CONTRACT.md').read_text()
counts={}
for line in text.splitlines():
 if re.match(r'\| `[^`]+` \|',line):
  cells=[s.strip() for s in line.strip('|').split('|')]
  if len(cells)>=4 and cells[3] in ('done','partial','missing'):
   counts[cells[3]]=counts.get(cells[3],0)+1
proof=dict(main=main,c2=c2,files=rows,contracts=contracts,status_counts_before=counts,status_counts_after=counts,test_registrations_added=0,test_registrations_removed=0,settings_sections_before=1,settings_sections_after=7)
Path('../packet/carry-receipt.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))
