import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const categories=['sql-syntax','foreign-key','sql-constraint','sql-missing-object','config','runtime','spawn','unknown'];
export function migrationFailure(result) {
 const stderr=String(result.stderr??'');
 const category=result.error?'spawn':/FOREIGN KEY constraint failed/i.test(stderr)?'foreign-key':
  /syntax error|incomplete input/i.test(stderr)?'sql-syntax':
  /constraint failed/i.test(stderr)?'sql-constraint':/no such (?:table|column)/i.test(stderr)?'sql-missing-object':
  /Couldn't find a D1 DB|Processing .* configuration|Invalid configuration|Unable to read.*config/i.test(stderr)?'config':
  /workerd|runtime failed|Miniflare/i.test(stderr)?'runtime':'unknown';
 return {category,status:Number.isInteger(result.status)?result.status:null};
}

// No exception messages, operands containing strings, request paths, or raw logs.
export function safeFailure(error) {
 const types=['AssertionError','TimeoutError','SyntaxError','TypeError','Error'];
 const result={type:types.includes(error?.name)?error.name:'Error'};
 const location=String(error?.stack??'').match(/\btests\/(?:product-runtime|worker|product-diagnostics|auth|archive)\.mjs:\d+:\d+(?=\)?(?:\n|$))/)?.[0];
 if(location)result.location=location;
 const codes=['ENOENT','EACCES','EEXIST','ENOTDIR','ENOSPC','ERR_ASSERTION','ECONNRESET','ECONNREFUSED'];
 if(codes.includes(error?.code))result.code=error.code;
 for(const field of ['actual','expected'])if(typeof error?.[field]==='boolean'||(typeof error?.[field]==='number'&&Number.isFinite(error[field])))result[field]=error[field];
 const request=error?.productRequest;
 if(request&&['GET','POST','PATCH','DELETE'].includes(request.method)&&Number.isInteger(request.status)){
  result.http={method:request.method,status:request.status};
  if(Number.isSafeInteger(request.ordinal))result.http.ordinal=request.ordinal;
 }
 if(categories.includes(error?.migration?.category))result.migration={category:error.migration.category,status:Number.isInteger(error.migration.status)?error.migration.status:null};
 return result;
}

// Retain only fixed classifications across chunk boundaries, never raw output.
export function workerOutput() {
 let tail='',lines=0,networkConnectionLost=false,d1Error=false,sqliteError=false;
 // Fixed presence flags only: source excerpts may also mention these names, so
 // they are evidence for investigation, not a claim about the exception class.
 const mentions=Object.fromEntries(['typeError','referenceError','rangeError','syntaxError','invalidProject','instanceofOperand','temporalDeadZone','undefinedAccess','notDefined','internalError','scriptNoResponse','contextNotFinalized','scrub','apiErrorHandler'].map(key=>[key,false]));
 const signatures={typeError:'TypeError:',referenceError:'ReferenceError:',rangeError:'RangeError:',syntaxError:'SyntaxError:',invalidProject:'Invalid project',instanceofOperand:"Right-hand side of 'instanceof'",temporalDeadZone:'before initialization',undefinedAccess:'Cannot read properties of undefined',notDefined:'is not defined',internalError:'internal error',scriptNoResponse:'The script will never generate a response',contextNotFinalized:'Context is not finalized',scrub:'at scrub',apiErrorHandler:'at Hono.errorHandler'};
 return {
  add(chunk){const text=tail+String(chunk);lines+=String(chunk).split('\n').length-1;networkConnectionLost||=text.includes('Network connection lost');d1Error||=text.includes('D1_ERROR');sqliteError||=text.includes('SQLITE_ERROR');for(const [key,signature] of Object.entries(signatures))mentions[key]||=text.includes(signature);tail=text.slice(-64)},
  summary(){return {redacted:true,lines,networkConnectionLost,d1Error,sqliteError,mentions:{...mentions}}}
 };
}
// Observe close at spawn time: exit status alone does not mean pipes drained.
const closedChildren=new WeakSet();
export function observeChild(child,output) {
 child.once('close',()=>closedChildren.add(child));
 child.stdout?.on('data',chunk=>output.add(chunk));child.stderr?.on('data',chunk=>output.add(chunk));
 child.on('error',error=>{child.fixtureSpawnError=error});
 return child;
}

export async function stopChild(child,{group=false}={}) {
 if(!child?.pid)return;
 const signal=value=>{try{if(group)process.kill(-child.pid,value);else child.kill(value)}catch(error){if(error.code!=='ESRCH')throw error}};
 const running=child.exitCode===null&&child.signalCode===null;
 // A previously observed close has already drained the child's stdio. The
 // process group may still outlive its parent, even after close.
 if(closedChildren.has(child)){if(group)signal('SIGKILL');return}
 await new Promise((done,reject)=>{
  let escalated=false;
  const clear=()=>{clearTimeout(timer);child.off('close',close);child.off('error',error)};
  // Successful escalation already signaled the group; close must not signal it again.
  const close=()=>{clear();try{if(group&&!escalated)signal('SIGKILL');done()}catch(e){reject(e)}};
  const error=e=>{clear();reject(e)};
  const timer=running?setTimeout(()=>{try{signal('SIGKILL');escalated=true}catch(e){error(e)}},5000):undefined;
  child.once('close',close);child.once('error',error);
  try{if(running)signal('SIGTERM');else{signal('SIGKILL');escalated=true}}catch(e){error(e)}
 });
}

export async function stopCommand(result) {
 // spawnSync has returned; kill any remaining descendants in its private group.
 if(!result.pid)return;
 try{process.kill(-result.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
}

export async function finishProductRun({failure,output,artifactDirectory,runId,cleanup}) {
 const result={failed:!!failure,...failure?{failure:safeFailure(failure)}:{},cleanupFailures:[]};
 for(const [step,run] of cleanup)try{await run()}catch(error){result.failed=true;result.cleanupFailures.push({step,...safeFailure(error)})}
 result.worker=output.summary();
 try {
  await mkdir(artifactDirectory,{recursive:true});
  const text=JSON.stringify(result,null,2)+'\n';
  await writeFile(resolve(artifactDirectory,'product-worker-'+runId+'.log'),text);
  await writeFile(resolve(artifactDirectory,'latest-product-worker.log'),text);
 }catch(error){result.failed=true;result.diagnosticsFailure=safeFailure(error)}
 return result;
}
