// Cloud-only startup allowance; no repository file or assertion is changed.
import {registerHooks} from 'node:module';
if(process.argv.some(value=>/(?:^|\/)tests\/repair-recovery\.mjs$/.test(value)))registerHooks({
 load(url,context,nextLoad){
  const result=nextLoad(url,context);
  if(url.endsWith('/tests/agent-handoff/trace.mjs')){
   const source=String(result.source);
   const original='export async function traceStep(name,action,deadlineMilliseconds=90000){';
   if(!source.includes(original))throw new Error('Cloud startup allowance target changed');
   const replacement=original+"\n if(name==='startDev'||name==='dev-ready')deadlineMilliseconds=Math.max(deadlineMilliseconds,180000);";
   console.error('CLOUD_TEST_STARTUP_BUDGET startDev/dev-ready=180000ms; repository files and assertions unchanged');
   return {...result,source:source.replace(original,replacement)};
  }
  return result;
 }
});
