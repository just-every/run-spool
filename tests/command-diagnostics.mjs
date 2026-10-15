import {types} from 'node:util';
import {runInNewContext} from 'node:vm';
import {loadRefusal} from './command-resources.mjs';

const stages=['checkout','contract','legacy-state','linked-settings','install','failed-build','slow-readiness','setup','owner-preservation','dev','desktop-sign-in','preview','mobile-preview','resume','export','reset','restore-policy','restore','deploy-dry-run','fresh-owner','complete'];
const commands=new Set(['check','install','setup','dev','preview','export','import','reset','deploy']);
const errorTypes=new Set(['Error','AssertionError','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','AggregateError','TimeoutError','AbortError']);
const sources=['commands.mjs','command-runner.mjs','command-diagnostics.mjs','auth.mjs','browser-launch.mjs','setup-journey.mjs','preview-session.mjs'];
const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000?value:null;
const exitCode=value=>Number.isSafeInteger(value)&&Math.abs(value)<=1_000_000?value:null;
function data(value,key){try{if(types.isProxy(value))return undefined;return Object.getOwnPropertyDescriptor(value,key)?.value;}catch{return undefined;}}
const cliErrorCodes=new Set(['invalid_invocation','missing_input','safety_refusal','command_failed','invalid_setup_manifest','outbox_unavailable','cancelled','server_bookkeeping_failed','app_exited','child_failed','transfer_failed']);
const refusalFamilies=new Set(['resource-load','resource-disk','active-operation','port','registry','owner','settings','state','unknown']);
const resourcePreflights=new Set(['not-requested','checking','passed','refused','failed']);
const resourceRefusals=new Set(['resource-load','resource-disk','unknown']);
// Only exact complete primary adapter progress lines become fixed identifiers.
// An observed marker describes output, not the cause of a later failure. The
// private 100000-character tail can lose earlier markers; unknown means absent
// from that tail, not proof a lifecycle phase never ran.
const lifecycleMarkers=new Map([
 ['Building your application','building'],
 ['Applying database migrations','migrating'],
 ['Starting your application on this computer','starting'],
 ['Claiming the first owner','claiming-owner'],
 ['First owner claimed','owner-claimed'],
 ['An owner is already claimed; the existing owner was kept','owner-kept'],
 ['Checking the existing owner through ordinary sign-in','checking-owner'],
 ['Opening sign-in through the development outbox','sign-in'],
 ['Your sign-in link is waiting in the development outbox','sign-in-ready'],
 ['Your application is running locally','complete'],
]);
const lifecycleValues=new Set(['unknown',...lifecycleMarkers.values()]);
// Exact primary CLI wording is consumed privately; only these fixed families leave.
const refusalMessages=new Map([
 ['Server startup requires 15 GiB free on checkout and temporary volumes. Recover owned space before retrying.','resource-disk'],
 ['An active local operation owns the state. Stop it before retrying.','active-operation'],
 ['An active local operation owns this installation. Stop dev/installer/transfer before reset.','active-operation'],
 ['Server registry directory is foreign or linked. Preserve it and choose an owned RER_SERVERS_DIR.','registry'],
 ['Server registry state is foreign or linked. Preserve it for inspection.','registry'],
 ['Concurrent server startup failed. Retry after recovery.','registry'],
 ['The existing server is still starting. Wait for its ready output.','registry'],
 ['Registered application failed health verification. Stop it before retrying.','registry'],
 ['Owner conflicts with the saved installation. Reuse its owner or back up data and run rer reset --yes.','owner'],
 ['Private owner settings are missing. Run rer setup first.','settings'],
 ['Local migrations, owner or local authentication/mail settings are missing. Run rer setup first.','settings'],
 ['Saved origin is malformed. Restore private settings or use confirmed reset.','settings'],
 ['Saved origin is unsafe. Restore private settings or use confirmed reset.','settings'],
 ['Setup origin conflicts with the saved installation. Reuse its origin or back up data and run rer reset --yes.','settings'],
 ['Local state placement is unsafe or ambiguous. Preserve legacy state and recover it explicitly before retrying.','state'],
]);
export function classifyCommandOutput(output,command){
 const result={cliErrorCode:'unknown',refusalFamily:'unknown',lifecycleMarker:'unknown'};
 if(typeof output!=='string'||!commands.has(command))return result;
 // The runner already bounds its private buffer. Ignore incomplete JSON lines.
 const lines=output.slice(-100000).split('\n');lines.pop();
 for(const [index,line] of lines.entries()){
  // The first line of a full tail may start midway through a private line.
  if(index>0||output.length<100000){const marker=lifecycleMarkers.get(line);if(marker)result.lifecycleMarker=marker;}
  let event;try{event=JSON.parse(line);}catch{continue;}
  if(data(event,'version')!==1||data(event,'event')!=='error'||data(event,'verb')!==command||exitCode(data(event,'exitCode'))===null)continue;
  const code=data(event,'code'),message=data(event,'message');
  result.cliErrorCode=cliErrorCodes.has(code)?code:'unknown';result.refusalFamily='unknown';
  if(!['safety_refusal','missing_input'].includes(code)||typeof message!=='string')continue;
  result.refusalFamily=loadRefusal.test(message)?'resource-load':refusalMessages.get(message)??'unknown';
  const port=/^Requested port ([0-9]{1,5}) is unavailable\. Stop its owner or choose an explicit free port; rer does not drift\.$/.exec(message);
  if(code==='safety_refusal'&&port&&Number(port[1])>=1&&Number(port[1])<=65535)result.refusalFamily='port';
 }
 return result;
}
// Probe the engine in a fresh realm without application formatter hooks. Older
// V8 data descriptors can format a lazy stack during descriptor inspection.
const stackAccessor=runInNewContext('typeof Object.getOwnPropertyDescriptor(new Error(),"stack").get === "function"');
const nativeStackGetter=stackAccessor?Object.getOwnPropertyDescriptor(new Error(),'stack')?.get:undefined;
function formatterAbsent(){
 let object=Error;
 for(let i=0;i<4&&object;i++){
  if(types.isProxy(object))return false;
  const property=Object.getOwnPropertyDescriptor(object,'prepareStackTrace');
  if(property)return 'value' in property&&property.value===undefined;
  object=Object.getPrototypeOf(object);
 }
 return !object;
}
function stackData(error){
 try{
  // V8's lazy native stack formatting can itself read name/message. Inspect
  // their descriptors first so a custom accessor cannot run through it.
  let object=error;
  for(let i=0;i<4&&object;i++){
   if(types.isProxy(object))return;
   for(const key of ['name','message']){const property=Object.getOwnPropertyDescriptor(object,key);if(property&&(!('value' in property)||(typeof property.value!=='string'&&property.value!==undefined)))return;}
   object=Object.getPrototypeOf(object);
  }
  if(object)return;
  if(!stackAccessor&&!formatterAbsent())return;
  const descriptor=Object.getOwnPropertyDescriptor(error,'stack');
  if(descriptor&&'value' in descriptor)return descriptor.value;
  // V8 also exposes its lazy stack as a shared native accessor on newer Node.
  // Never invoke an error's custom getter.
  if(nativeStackGetter&&descriptor?.get===nativeStackGetter&&formatterAbsent())return nativeStackGetter.call(error);
 }catch{}
}
const childOutcome=value=>['stopped','timeout','failed'].includes(value)?value:'failed';
const directoryOutcome=value=>['removed','timeout','failed'].includes(value)?value:'failed';
function safeCommand(item){
 const command=data(item,'command');
 const result={ordinal:integer(data(item,'ordinal')),command:commands.has(command)?command:'unknown',exitCode:exitCode(data(item,'exitCode'))};
 const code=data(item,'cliErrorCode'),family=data(item,'refusalFamily');
 result.cliErrorCode=cliErrorCodes.has(code)?code:'unknown';result.refusalFamily=refusalFamilies.has(family)?family:'unknown';
 const marker=data(item,'lifecycleMarker'),preflight=data(item,'resourcePreflight'),resource=data(item,'resourcePreflightRefusal');
 result.lifecycleMarker=lifecycleValues.has(marker)?marker:'unknown';
 result.resourcePreflight=resourcePreflights.has(preflight)?preflight:'not-requested';
 result.resourcePreflightRefusal=resourceRefusals.has(resource)?resource:'unknown';
 for(const flag of ['spawned','exited','spawnFailed','timedOut','readinessObserved','healthChecked','outboxChecked'])result[flag]=data(item,flag)===true;
 return result;
}
function safeSnapshot(snapshot){
 const candidateStage=data(snapshot,'stage'),stage=stages.includes(candidateStage)?candidateStage:'checkout';
 const error=data(snapshot,'error'),command=data(snapshot,'command'),type=data(error,'type'),candidateSource=data(error,'source');
 const source=sources.includes(candidateSource)?candidateSource:null;
 return {stage,stageOrdinal:stages.indexOf(stage)+1,command:command?safeCommand(command):null,
  error:{type:errorTypes.has(type)?type:'NonError',source,line:source?integer(data(error,'line')):null}};
}

// Read only inert properties, and emit only fixed identifiers and bounded numbers.
// Error messages, arbitrary frames, causes and assertion values stay private.
export function safeFailure(error){
 let type='NonError',source=null,line=null;
 if(types.isNativeError(error)){
  type='Error';let object=error;
  for(let i=0;i<4&&object;i++){
   if(types.isProxy(object))break;
   const name=data(object,'name');if(errorTypes.has(name)){type=name;break;}
   try{object=Object.getPrototypeOf(object);}catch{break;}
  }
  const stack=stackData(error);
  if(typeof stack==='string')for(const frame of stack.slice(0,65_536).split('\n').slice(1,80)){
   for(const name of sources){
    const url=new URL(name,import.meta.url).href;
    const escaped=url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=new RegExp('(?:\\(|\\s)'+escaped+':([0-9]{1,6}):[0-9]{1,6}\\)?$').exec(frame);
    if(match){source=name;line=integer(Number(match[1]));break;}
   }
   if(source)break;
  }
 }
 return {type,source,line};
}

export function journeyDiagnostics(){
 let stage='checkout',commandOrdinal=0,current=null,acquisitionCleanup=null;
 return {
  stage(value){if(!stages.includes(value))throw new Error('Unknown command journey stage');stage=value;},
  started(name){
   const item={ordinal:++commandOrdinal,command:commands.has(name)?name:'unknown',exitCode:null,cliErrorCode:'unknown',refusalFamily:'unknown',lifecycleMarker:'unknown',resourcePreflight:'not-requested',resourcePreflightRefusal:'unknown',spawned:false,exited:false,spawnFailed:false,timedOut:false,readinessObserved:false,healthChecked:false,outboxChecked:false};
   current=item;return item;
  },
  failure(error){return {stage,stageOrdinal:stages.indexOf(stage)+1,command:current?safeCommand(current):null,error:safeFailure(error)};},
  checkoutCleanup(result){acquisitionCleanup={children:childOutcome(data(result,'children')),directory:directoryOutcome(data(result,'directory'))};},
  acquisitionCleanup(){return acquisitionCleanup?{...acquisitionCleanup}:null;},
 };
}

// Deadline means cleanup is still unconfirmed, not cancelled. Handle even a
// later rejection without letting it replace the original failure snapshot.
export async function boundedCleanup(operation){
 let timer;
 try{
  return await Promise.race([
   Promise.resolve().then(operation).then(()=>({outcome:'complete'}),error=>({outcome:'failed',error})),
   new Promise(resolve=>{timer=setTimeout(()=>resolve({outcome:'timeout'}),10_000);}),
  ]);
 }finally{clearTimeout(timer);}
}

// Both cleanup paths run even when one fails. Neither may replace the failure.
export async function finishJourney(diagnostics,failure,browser,checkout){
 const cleanup={browser:'not-started',children:'not-started',directory:'not-started'};
 const acquired=diagnostics.acquisitionCleanup();if(acquired)Object.assign(cleanup,acquired);
 let cleanupFailure=null;
 await Promise.all([
  (async()=>{
   if(!browser)return;
   try{
    const result=await boundedCleanup(()=>browser.close());
    cleanup.browser=result.outcome==='complete'?'closed':result.outcome;
    if(result.outcome!=='complete')cleanupFailure??=diagnostics.failure(result.outcome==='failed'?result.error:new Error('Browser cleanup timed out'));
   }catch(error){cleanup.browser='failed';cleanupFailure??=diagnostics.failure(error);}
  })(),
  (async()=>{
   if(!checkout)return;
   try{const result=await checkout.close();
    cleanup.children=childOutcome(data(result,'children'));
    cleanup.directory=directoryOutcome(data(result,'directory'));
    if(cleanup.children!=='stopped'||cleanup.directory!=='removed')cleanupFailure??=diagnostics.failure(new Error('Checkout cleanup incomplete'));
   }catch(error){cleanup.children='failed';cleanup.directory='failed';cleanupFailure??=diagnostics.failure(error);}
  })(),
 ]);
 if(failure||cleanupFailure){
  const report={journey:'spool-commands',...safeSnapshot(failure??cleanupFailure),cleanup};
  // A broken diagnostic sink cannot obscure the original safe failure summary.
  try{console.error(JSON.stringify(report));}catch{}
  throw new Error('Spool command journey failed: '+JSON.stringify(report));
 }
}
