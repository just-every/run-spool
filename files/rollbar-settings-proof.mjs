import {pathToFileURL} from 'node:url';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),load=path=>import(pathToFileURL(root+'/'+path));
const {admissionRuntime}=await load('tests/admission-runtime.mjs');
const {signIn}=await load('tests/auth.mjs');
const {rollbarImportCli}=await load('scripts/rollbar-import.mjs');
const {rollbarFixture}=await load('tests/rollbar-import/fixture.mjs');
const {launchBrowser}=await load('tests/browser-launch.mjs');
const scratch=await mkdtemp(join(tmpdir(),'spool-settings-import-proof-'));
let app,browser;
const proof={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),purpose:'Report-only proof of the changed Settings history route; no test modification or bypass claim',screens:[]};
try{
 app=await admissionRuntime({}, {port:15539,hostedMail:true,networkEdge:async()=>new Response('',{status:503})});
 const cookie=await signIn(app.origin,{emailLink:true});process.env.SPOOL_ROLLBAR_PROOF_SESSION=cookie;
 const cli=(action,...args)=>rollbarImportCli([action,'--endpoint',app.origin,'--session-env','SPOOL_ROLLBAR_PROOF_SESSION',...args]);
 const input=join(scratch,'synthetic-rollbar.json');await writeFile(input,JSON.stringify(rollbarFixture()),{mode:0o600});
 const plan=await cli('dry-run','--file',input);
 const args=['--project','71','--plan',plan.planId,'--fingerprint',plan.fingerprint];
 await cli('apply',...args);const report=await cli('reconcile','--project','71','--plan',plan.planId);
 const project=report.projectIds[0];proof.importReconciled=report.ok;
 browser=await launchBrowser();await mkdir('../packet/screens',{recursive:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:app.origin.replace('http:','https:'),secure:true}]);
   const page=await context.newPage();await page.goto(app.origin+`/projects/${project}/settings#settings-data`);
   await page.getByText('Business imports',{exact:true}).first().waitFor();
   await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
   await page.getByText('rollbar-project:71',{exact:true}).waitFor();
   const file=`screens/settings-rollbar-history-${width}.png`;
   await page.screenshot({path:'../packet/'+file,mask:[page.locator('.secret-key,input[type="password"],[data-secret]')]});
   proof.screens.push({width,file,fragment:new URL(page.url()).hash,historyVisible:true,pageWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
  }finally{await context.close()}
 }
 await writeFile('../packet/rollbar-settings-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log('Changed Settings history route rendered imported Rollbar custody at 1440 and 390; full legacy Rollbar suite remains separately reported as failed.');
}finally{await browser?.close();await app?.close();delete process.env.SPOOL_ROLLBAR_PROOF_SESSION;await rm(scratch,{recursive:true,force:true})}
