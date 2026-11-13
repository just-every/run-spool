import datetime,json,os,pathlib,time
packet=pathlib.Path('/home/agent/rer-consolidation/work/sd-spool-slack-flake-1/packet')
deadline=time.monotonic()+7200
def children(pid):
 try:return [int(p) for p in pathlib.Path(f'/proc/{pid}/task/{pid}/children').read_text().split()]
 except OSError:return []
def release(pid):
 for child in children(pid):
  try:
   for thread in pathlib.Path(f'/proc/{child}/task').iterdir():
    try:os.sched_setaffinity(int(thread.name),{0,1,2,3,4})
    except (OSError,ValueError):pass
   release(child)
  except OSError:pass
while time.monotonic()<deadline:
 # Restrict only the egress test's main JS host, where binding replies arrive.
 # Worker CPU work and compiler helpers retain the VM's full CPU set.
 for entry in pathlib.Path('/proc').iterdir():
  if not entry.name.isdigit():continue
  try:
   parts=(entry/'cmdline').read_bytes().split(b'\0')
   if any(p.endswith(b'/tests/alerts-egress.mjs') or p==b'tests/alerts-egress.mjs' for p in parts) and pathlib.Path(parts[0].decode()).name=='node':
    release(int(entry.name))
  except (OSError,UnicodeError):pass
 time.sleep(0.1)
