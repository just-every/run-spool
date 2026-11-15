import os,json,subprocess,tempfile
from pathlib import Path
repo=Path.cwd()
packet=Path.home()/'rer-consolidation/work/gr-mt-spool-dep-9/packet'
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
env=dict(os.environ)
values=dict(line.rstrip('\n').split('=',1) for line in (Path.home()/'.rer-cloud.env').open() if '=' in line)
env['GH_TOKEN']=values['GH_TOKEN']
env['PATH']=str(Path.home()/'.local/bin')+':'+env['PATH']
with tempfile.TemporaryDirectory(prefix='spool-committed-scan-') as root:
 target=Path(root)/'tree';target.mkdir()
 entries=subprocess.check_output(['git','ls-tree','-r','-z',sha]).split(b'\0')
 for entry in filter(None,entries):
  meta,path=entry.split(b'\t');mode,kind,oid=meta.split()
  assert kind==b'blob' and mode in (b'100644',b'100755')
  dest=target/os.fsdecode(path);dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_bytes(subprocess.check_output(['git','cat-file','blob',oid.decode()]))
  dest.chmod(0o755 if mode==b'100755' else 0o644)
 subprocess.run(['git','clone','--mirror','--no-hardlinks','--quiet',str(repo),str(target/'.git')],check=True,env=env)
 for k,v in [('user.name','Run Edit Run fleet'),('user.email','fleet@runeditrun.com'),('core.bare','false'),('remote.origin.url','https://github.com/just-every/run-spool.git'),('remote.origin.promisor','true'),('remote.origin.partialclonefilter','blob:none')]:
  subprocess.run(['git','--git-dir',str(target/'.git'),'config',k,v],check=True)
 subprocess.run(['git','-C',str(target),'update-ref','--no-deref','HEAD',sha],check=True)
 subprocess.run(['git','-C',str(target),'read-tree',sha],check=True)
 command=['node',str(repo/'node_modules/@runeditrun/rer/scripts/publish-check.mjs'),'--repo',str(target),'--ref',sha,'--public-base','https://github.com/just-every/run-spool.git#main','--env-file',str(Path.home()/'.rer-cloud.env'),'--project','just-every/spool','--repository','https://github.com/just-every/run-spool.git','--timeout-seconds','1800']
 result=subprocess.run(command,env=env,capture_output=True,text=True)
 (packet/'publication-scan.json').write_text(result.stdout)
 try:
  report=json.loads(result.stdout)
  print(json.dumps({k:report.get(k) for k in ['status','complete','source','findings','guarantees']},indent=2))
  print('PUBLICATION_EXIT='+str(result.returncode))
 except ValueError: print('PUBLICATION_INVALID_REPORT exit='+str(result.returncode))
 raise SystemExit(result.returncode)
