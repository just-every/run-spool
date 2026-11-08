import { createDiagnoser } from '../artifacts';
import { diagnosticProjection } from '../agent-projection';
import { hash, identity, type Envelope, type Frame } from '../privacy';

const pageSize=30;
/** A current lookup over one retained JavaScript exception, in stored SDK order.
 * These indices never replace the immutable, bounded admission diagnostics. */
export async function mappedFramePage(db:D1Database, project:string, issue:string, event:Envelope,
 occurrence:string, selector:string|undefined, cursor:string|undefined) {
 if(event.language||!event.sentry||!['javascript',undefined].includes(event.sentry.platform))throw new Error('Current mapped pages require a JavaScript exception');
 if(selector===undefined||!/^(0|[1-9]\d*)$/.test(selector))throw new Error('Exact exception index required');
 const exceptionIndex=Number(selector),exception=event.sentry.exceptions[exceptionIndex];
 if(!Number.isSafeInteger(exceptionIndex)||!exception?.stacktrace)throw new Error('Exception stack not found');
 const frames=exception.stacktrace.frames;
 const signature=await hash(JSON.stringify([project,issue,event.eventId,occurrence,exceptionIndex]));
 let start=0;
 if(cursor!==undefined){
  let value:any;try{if(cursor.length>1024)throw new Error();value=JSON.parse(atob(cursor))}catch{throw new Error('Invalid mapped frame cursor')}
  if(value?.signature!==signature||!Number.isSafeInteger(value.start)||value.start<=0||value.start%pageSize!==0||value.start>=frames.length)throw new Error('Mapped frame cursor belongs to another stack or page');
  start=value.start;
 }
 const images=Array.isArray(event.sentry.debug_meta?.images)?event.sentry.debug_meta.images:[];
 const lookup=createDiagnoser(db,project),rows=[];
 for(const [index,frame] of frames.slice(start,start+pageSize).entries()){
  const path=frame.abs_path??frame.filename;
  const generated={file:path??'<unlocated>',line:frame.lineno??null,column:frame.colno==null?null:frame.colno-1,function:frame.function??'<anonymous>'};
  let diagnostic:any;
  if(typeof path!=='string'||!Number.isSafeInteger(frame.lineno)||frame.lineno!<1||frame.lineno!>1e7||!Number.isSafeInteger(frame.colno)||frame.colno!<1||frame.colno!>1e7){
   diagnostic={generated,status:'missing_position'};
  }else{
   const matches=images.filter((image:any)=>image?.type==='sourcemap'&&image.code_file===path) as any[];
   const ids=new Set(matches.map(image=>image.debug_id));
   let debugId:string|undefined,reason='';
   if(ids.size>1)reason='conflicting_debug_ids';
   else if(matches[0]?.debug_id!==undefined){try{debugId=identity(matches[0].debug_id,'debugId')}catch{reason='invalid_debug_id'}}
   if(reason)diagnostic={generated,status:reason};
   else diagnostic=diagnosticProjection(await lookup(event,[{...generated,...debugId?{debugId}:{}} as Frame]))[0];
  }
  rows.push({exceptionIndex,frameIndex:start+index,...diagnostic});
 }
 return {version:1,lookup:'current',event:event.eventId,occurrence,exceptionIndex,total:frames.length,start,rows,
  next:start+pageSize<frames.length?btoa(JSON.stringify({signature,start:start+pageSize})):null};
}
