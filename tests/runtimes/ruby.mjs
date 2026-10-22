import {cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';

const here=resolve(import.meta.dirname,'ruby');
const bundle=dir=>({BUNDLE_PATH:resolve(dir,'vendor'),BUNDLE_GEMFILE:resolve(dir,'Gemfile')});
export default {
 name:'ruby',sdk:'sentry.ruby',version:'sentry-ruby 7.1.0',
 required:['event','sessions','transaction','log','attachment','check_in'],
 chain:['ZeroDivisionError','ArgumentError'],
 async prepare(dir){
  await cp(here,dir,{recursive:true});
  await runOk('bundle',['install','--quiet'],{cwd:dir,env:bundle(dir)});
 },
 command(mode,dir,dsn,cwd=dir){return {command:'bundle',args:['exec','ruby',resolve(dir,'app.rb'),mode],cwd,env:{...bundle(dir),SPOOL_FIXTURE_DSN:dsn}}},
};
