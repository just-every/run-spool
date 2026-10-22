import {cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';

const target=dir=>process.env.CARGO_TARGET_DIR??resolve(dir,'target');

const here=resolve(import.meta.dirname,'rust');
export default {
 name:'rust',sdk:'sentry.rust',version:'sentry 0.49.3',
 required:['event','session','transaction','log','attachment','client_report'],
 chain:['CauseError','CheckoutError'],
 async prepare(dir){
  await cp(here,dir,{recursive:true,filter:path=>!path.includes('/target')});
  await runOk('cargo',['build','--release','--quiet'],{cwd:dir});
 },
 command(mode,dir,dsn,cwd=dir){return {command:resolve(target(dir),'release/spool-runtime-rust'),args:[mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn}}},
};
