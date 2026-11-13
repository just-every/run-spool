import argparse, datetime, json, os, pathlib, subprocess, time
parser=argparse.ArgumentParser()
parser.add_argument('phase')
parser.add_argument('count',type=int)
args=parser.parse_args()
packet=pathlib.Path('/home/agent/rer-consolidation/work/sd-spool-slack-flake-1/packet')
command=['timeout','--kill-after=10s','20m','bash','-e','-o','pipefail','-c','pnpm test:alerts && pnpm test:alerts-ui']
receipt=packet/(args.phase+'-receipt.json')
rows=[]
for i in range(1,args.count+1):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 log=packet/f'{args.phase}-{i}.log'
 print(f'{args.phase} run={i} started={start}',flush=True)
 t=time.monotonic()
 with log.open('w') as stream:
  result=subprocess.run(command,stdout=stream,stderr=subprocess.STDOUT)
 row=dict(run=i,started_utc=start,finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsed_seconds=round(time.monotonic()-t,3),exit_code=result.returncode,log=log.name)
 rows.append(row)
 receipt.write_text(json.dumps(dict(phase=args.phase,command=command,node=subprocess.check_output(['node','--version'],text=True).strip(),chromium='/usr/bin/chromium',source_head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),runs=rows,passed=sum(r['exit_code']==0 for r in rows),failed=sum(r['exit_code']!=0 for r in rows)),indent=2)+'\n')
 print(json.dumps(row),flush=True)
 if result.returncode:
  lines=log.read_text(errors='replace').splitlines()
  print('\n'.join(lines[-26:]),flush=True)
