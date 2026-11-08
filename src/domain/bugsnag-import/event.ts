import { convertSentry } from '../sentry/convert';
import { sha256 } from '../../modules/import-kit/src/provenance/identity';
import { identity } from '../privacy';
export const eventId=(org:string,project:string,id:string)=>sha256(JSON.stringify(['bugsnag',org,project,id])).slice(0,32);
export function releaseIdentity(version:any,stage:any,build:any) {
 return identity(`${identity(version,'release')}@${identity(stage,'environment')}+${identity(String(build??'unspecified'),'build')}`,'release');
}
const frame=(f:any)=>({filename:f.file,function:f.method,lineno:f.lineNumber,colno:Number.isSafeInteger(f.columnNumber)?f.columnNumber+1:undefined,
 in_app:f.inProject,instruction_addr:f.frameAddress,symbol_addr:f.symbolAddress,image_addr:f.loadAddress,package:f.code_file,
 ...f.macho_uuid?{module:f.macho_uuid}:{}});
/** Bugsnag's newest-first exceptions and frames are reordered for native evidence. */
export function bugsnagEvent(data:any,org:string,project:string) {
 if(!Array.isArray(data.exceptions)||!data.exceptions.length)throw new Error('Full Bugsnag event exceptions required');
 const app=data.app??{},received=Date.parse(data.received_at);
 if(!Number.isSafeInteger(received)||received<0)throw new Error('Bugsnag event timestamp required');
 const event=convertSentry({event_id:eventId(org,project,data.id),platform:app.type==='ios'?'cocoa':app.type==='android'?'java':'javascript',
 release:releaseIdentity(app.version,app.releaseStage,app.versionCode??app.bundleVersion),dist:String(app.versionCode??app.bundleVersion??'unspecified'),environment:app.releaseStage,
 exception:{values:[...data.exceptions].reverse().map((e:any)=>({type:e.errorClass,value:e.message,stacktrace:{frames:[...(e.stacktrace??[])].reverse().map(frame)}}))},
 threads:(data.threads??[]).map((t:any)=>({id:t.id,name:t.name,crashed:t.errorReportingThread,stacktrace:{frames:[...(t.stacktrace??[])].reverse().map(frame)}})),
 breadcrumbs:[...(data.breadcrumbs??[])].reverse().map((b:any)=>({message:b.name,category:b.type})),level:data.severity});
 return {event,received,raw:false};
}
