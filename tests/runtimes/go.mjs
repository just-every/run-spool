import {resolve} from 'node:path';
import {cp} from 'node:fs/promises';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'go');
export default {
 name:'go',sdk:'sentry.go',version:'sentry-go v0.50.0',
 required:['event','transaction','log','attachment','check_in','client_report'],
 chain:['*main.causeError','*main.checkoutError'],
 unhandled:sentry=>sentry.level==='fatal',
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('go',['build','-o',resolve(dir,'app'),'.'],{cwd:dir,env:{GOTOOLCHAIN:'local',GOFLAGS:'-mod=mod'}});
 },
 command(mode,dir,dsn,cwd=dir){return {command:resolve(dir,'app'),args:[mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn}}},
};
