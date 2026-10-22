import {cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'php');
export default {
 name:'php',sdk:'sentry.php',version:'sentry/sentry 4.34.0',
 required:['event','transaction','log','attachment','check_in'],
 chain:['DivisionByZeroError','RuntimeException'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('composer',['install','--quiet','--no-interaction','--no-progress'],{cwd:dir});
 },
 command(mode,dir,dsn,cwd=dir){return {command:'php',args:['-d','display_errors=0',resolve(dir,'app.php'),mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn}}},
};
