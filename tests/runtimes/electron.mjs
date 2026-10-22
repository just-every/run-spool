import assert from 'node:assert/strict';
import {cp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runOk} from './harness.mjs';
import {readScreens} from './screens.mjs';
const here=resolve(import.meta.dirname,'electron');
const executable=dir=>resolve(dir,'packaged/spool-qualification-linux-x64/spool-qualification');
export default {
 name:'electron',sdk:'sentry.javascript.electron',version:'@sentry/electron 8.3.0; electron 45.0.0; @electron/packager 20.3.0',
 required:['event','session','transaction','log','attachment','feedback','replay_event','replay_recording','client_report'],chain:['MainHandledError'],
 async prepare(dir){
  assert.equal(process.platform,'linux','Electron qualification runs only in the Linux virtual-display CI job');
  await cp(here,resolve(dir,'app'),{recursive:true});await mkdir(resolve(dir,'state'));
  await runOk('npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:resolve(dir,'app')});
  await runOk(process.execPath,['--input-type=module','-e',`import {packager} from '@electron/packager';await packager({dir:process.cwd(),out:'../packaged',name:'spool-qualification',platform:'linux',arch:'x64',electronVersion:'45.0.0',asar:true,overwrite:true});`],{cwd:resolve(dir,'app')});
 },
 command(mode,dir,dsn){return {command:executable(dir),args:['--no-sandbox','--disable-gpu'],cwd:dir,env:{SPOOL_FIXTURE_MODE:mode,SPOOL_FIXTURE_DSN:dsn,SPOOL_FIXTURE_STATE:resolve(dir,'state')}}},
 async verify({details,project,origin,cookie}){
  const byType=type=>details.find(d=>d.events.some(e=>e.event.sentry.exceptions.some(x=>x.type===type)));
  const handled=byType('RendererHandledError');assert.ok(handled);assert.equal(handled.issue.count,2,'renderer flush/relaunch grouping');
  for(const type of ['MainUnhandledError','RendererUnhandledError']){
   const group=byType(type);assert.ok(group,`${type} persisted`);assert.equal(group.issue.count,1);
   assert.ok(group.events.every(e=>e.event.sentry.exceptions.some(x=>x.type===type&&x.mechanism?.handled===false)));
  }
  assert.equal(new Set(details.flatMap(d=>d.events.map(e=>e.id))).size,6,'one occurrence for each main/renderer capture across launches');
  await readScreens(origin,cookie,[
   ...['RendererHandledError','MainUnhandledError','RendererUnhandledError'].map(type=>({name:`electron-${type}`,path:`/projects/${project.id}/issues/${byType(type).issue.id}`,check:page=>page.locator('article.exception h3').filter({hasText:type}).first().waitFor()})),
   {name:'electron-diagnostics',path:`/projects/${project.id}/capture`,check:page=>page.getByRole('heading',{name:'SDK discarded',exact:true}).waitFor()},
  ]);
 },
};
