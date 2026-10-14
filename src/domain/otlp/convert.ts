import { frames } from '../capture';
import { normalize, canonical, hash, type Envelope } from '../privacy';
import { attributes, textAttribute, integer, anyValue, uint32 } from './values';
import { object, list, OtlpError } from './wire';
type Candidate={record:any;resource:any;scope:any;resourceSchemaUrl:any;scopeSchemaUrl:any;attrs:Map<string,any>};
export type Prepared={event:Envelope;digest:string}|{reason:string};
function optionalText(value:any){if(value!==undefined&&typeof value!=='string')throw new OtlpError('invalid_structure')}
/** Inspect every group before conversion or admission, including trailing groups. */
export function candidates(body:Record<string,any>):Candidate[]{
  const result:Candidate[]=[];let scopes=0;
  for(const group of list(body.resourceLogs,16)){
    object(group);optionalText(group.schemaUrl);const resource=group.resource===undefined?{}:object(group.resource),attrs=attributes(resource.attributes);
    if(resource.droppedAttributesCount!==undefined)uint32(resource.droppedAttributesCount);
    for(const scoped of list(group.scopeLogs,16)){
      if(++scopes>16)throw new OtlpError('scope_limit',413);
      object(scoped);optionalText(scoped.schemaUrl);const scope=scoped.scope===undefined?{}:object(scoped.scope);
      optionalText(scope.name);optionalText(scope.version);attributes(scope.attributes);if(scope.droppedAttributesCount!==undefined)uint32(scope.droppedAttributesCount);
      for(const record of list(scoped.logRecords,32)){
        if(result.length>=32)throw new OtlpError('record_limit',413);
        result.push({record,resource,scope,attrs,resourceSchemaUrl:group.schemaUrl??'',scopeSchemaUrl:scoped.schemaUrl??''});
      }
    }
  }
  return result;
}
function convert(candidate:Candidate):Envelope{
  const r=object(candidate.record),a=attributes(r.attributes);
  if(r.body!==undefined)anyValue(r.body);
  for(const key of ['timeUnixNano','observedTimeUnixNano'])if(r[key]!==undefined)integer(r[key],true);
  for(const key of ['severityText','eventName'])optionalText(r[key]);
  if(r.severityNumber!==undefined&&(!Number.isInteger(r.severityNumber)||r.severityNumber<0||r.severityNumber>24))throw new OtlpError('invalid_severity');
  for(const key of ['flags','droppedAttributesCount'])if(r[key]!==undefined)uint32(r[key]);
  for(const [key,length] of [['traceId',32],['spanId',16]] as const)if(r[key]!==undefined&&(typeof r[key]!=='string'||r[key]!==''&&!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(r[key])))throw new OtlpError('invalid_trace_context');
  const hasException=['exception.type','exception.message','exception.stacktrace'].some(key=>a.has(key));
  const kind=a.has('spool.event_type')?textAttribute(a,'spool.event_type'):hasException?'exception':'log';
  if(!['log','exception'].includes(kind)||kind==='log'&&hasException)throw new OtlpError('unsupported_event_type');
  let type:string,message:string,locations;
  if(kind==='exception'){
    type=textAttribute(a,'exception.type');message=textAttribute(a,'exception.message');locations=frames(textAttribute(a,'exception.stacktrace'));
    if(!locations.length)throw new OtlpError('unsupported_stack');
  }else{
    type='Log';if(typeof r.body?.stringValue!=='string')throw new OtlpError('unsupported_log_body');message=r.body.stringValue;
    const file=textAttribute(a,'code.file.path'),fn=textAttribute(a,'code.function.name');
    if(!file.trim()||!fn.trim())throw new OtlpError('missing_code_location');
    const line=Number(integer(a.get('code.line.number')?.intValue)),column=Number(integer(a.get('code.column.number')?.intValue));
    if(line<1||column<1)throw new OtlpError('invalid_code_location');
    locations=[{file,function:fn,line,column:column-1}];
  }
  return normalize({version:1,eventId:textAttribute(a,'spool.event_id'),release:textAttribute(candidate.attrs,'service.version'),build:textAttribute(candidate.attrs,'spool.build'),environment:textAttribute(candidate.attrs,'deployment.environment.name'),type,message,frames:locations,breadcrumbs:[]});
}
export async function prepare(candidate:Candidate):Promise<Prepared>{
  let event:Envelope;try{event=convert(candidate)}catch(error){return {reason:error instanceof OtlpError?error.reason:'invalid_native_event'}}
  // Preserve association and all original record/resource fields, before normalization or scrubbing.
  const {record,resource,scope,resourceSchemaUrl,scopeSchemaUrl}=candidate;
  return {event,digest:await hash(canonical({record,resource,scope,resourceSchemaUrl,scopeSchemaUrl}))};
}
