import {cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'elixir');
export default {
 name:'elixir',sdk:'sentry-elixir',version:'sentry 14.0.0',
 required:['event','transaction','log','attachment','check_in','client_report'],
 chain:['ArithmeticError'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('mix',['deps.get'],{cwd:dir});
  await runOk('mix',['compile'],{cwd:dir});
 },
 command(mode,dir,dsn){return {command:'mix',args:['run','--no-compile','--no-deps-check',resolve(dir,'app.exs'),mode],cwd:dir,env:{SPOOL_FIXTURE_DSN:dsn}}},
};
