import {resolve} from 'node:path';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'python');
export default {
 name:'python',sdk:'sentry.python',version:'sentry-sdk 2.72.0',
 required:['event','transaction','log','attachment','check_in','client_report'],
 chain:['ZeroDivisionError','ValueError'],
 async prepare(dir){
  await runOk('python3',['-m','venv',resolve(dir,'venv')]);
  await runOk(resolve(dir,'venv/bin/pip'),['install','--quiet','--disable-pip-version-check','sentry-sdk==2.72.0','django==5.2.8']);
 },
 command(mode,dir,dsn,cwd=dir){return {command:resolve(dir,'venv/bin/python'),args:[resolve(here,'app.py'),mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn}}},
};
