import datetime, json, os, pathlib, signal, subprocess, sys, time
phase=sys.argv[1];first=int(sys.argv[2]);last=int(sys.argv[3])
packet=pathlib.Path('/home/agent/rer-consolidation/work/sd-spool-slack-flake-1/packet')
marker='[ALERT-002] reviewed Slack test, exactly-once new/regression'
rows=[]
for run in range(first,last+1):
 log=packet/f'{phase}-{run}.log'
 print(f'load monitor waiting {log.name}',flush=True)
 while not log.exists() or marker not in log.read_text(errors='replace'):
  time.sleep(1)
 candidates=[]
 for entry in pathlib.Path('/proc').iterdir():
  if not entry.name.isdigit():continue
  try:
   parts=(entry/'cmdline').read_bytes().split(b'\0')
   if any(p.endswith(b'/tests/alerts-egress.mjs') or p==b'tests/alerts-egress.mjs' for p in parts) and b'node' in pathlib.Path(parts[0].decode()).name.encode():
    candidates.append(int(entry.name))
  except (OSError,UnicodeError):pass
 if len(candidates)!=1:
  raise RuntimeError('expected one running egress test, found '+str(candidates))
 target=candidates[0];original=os.sched_getaffinity(target)
 # Isolate the actual test host and its future Worker children on one busy CPU.
 os.sched_setaffinity(target,{0})
 hogs=[]
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  for _ in range(40):
   hogs.append(subprocess.Popen(['taskset','-c','0','python3','-c','while True: pass'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
  print(f'load started run={run} host_pid={target} cpu=0 busy_processes=40 at={started}',flush=True)
  while pathlib.Path('/proc',str(target)).exists():
   time.sleep(1)
 finally:
  for child in hogs:
   child.terminate()
  for child in hogs:
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:
    child.kill();child.wait()
  try:os.sched_setaffinity(target,original)
  except ProcessLookupError:pass
 rows.append(dict(run=run,started_utc=started,finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),host_pid=target,cpu=0,busy_processes=40,trigger=marker))
 (packet/f'{phase}-load-receipt.json').write_text(json.dumps(rows,indent=2)+'\n')
 print(f'load ended run={run}',flush=True)
