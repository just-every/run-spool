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
 command(mode,dir,dsn,cwd=dir){
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(dsn).hostname))throw new Error('Rust fixture requires a loopback collector');
  // sentry-rust turns proxy environment values into explicit reqwest proxies,
  // which ignore NO_PROXY. Only this loopback-only child bypasses that proxy;
  // its SDK options stay identical for the reference collector and Spool.
  return {command:resolve(target(dir),'release/spool-runtime-rust'),args:[mode],cwd,env:{SPOOL_FIXTURE_DSN:dsn,HTTP_PROXY:'',HTTPS_PROXY:'',http_proxy:'',https_proxy:'',ALL_PROXY:'',all_proxy:''}};
 },
};
