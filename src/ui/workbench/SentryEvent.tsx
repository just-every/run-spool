import {useState} from 'react';
import {Details} from './Details';

const hidden=(frame:any)=>frame.vars?.__traceback_hide__===true||frame.vars?.__traceback_hide__==='true'||frame.vars?.__traceback_hide__==='True';
function rawStack(data:any) {
 const python=data.platform==='python',java=['java','jvm'].includes(data.platform);
 return (data.exceptions?.length?data.exceptions:[{type:'Message',value:data.logentry?.formatted??data.message,stacktrace:data.stacktrace}]).map((exception:any,index:number)=>{
  const frames=(exception.stacktrace?.frames??[]).filter((f:any)=>!hidden(f));
  const header=`${exception.type??'Error'}: ${exception.value??''}`;
  const lines=frames.map((f:any)=>python?`  File "${f.filename??f.abs_path??'<unknown>'}", line ${f.lineno??'?'}, in ${f.function??'<unknown>'}`:`    at ${f.function??'<anonymous>'} (${f.filename??f.abs_path??'<unknown>'}:${f.lineno??'?'}:${f.colno??'?'})`);
  return python?['Traceback (most recent call last):',...lines,header].join('\n'):[`${index&&java?'Caused by: ':''}${header}`,...lines.reverse()].join('\n');
 }).join(python?'\n\nThe above exception was the cause/context of the following exception:\n\n':'\n\n');
}
function Frame({frame,index,classification}:{frame:any;index:number;classification?:any}) {
 if(hidden(frame))return <li>Frame {index+1} hidden by __traceback_hide__; excluded from grouping.</li>;
 const content=<><code>{frame.abs_path??frame.filename??'<unlocated>'}:{frame.lineno??'?'}{frame.colno==null?'':`:${frame.colno}`} · {frame.function??frame.raw_function??'<anonymous>'}</code>
  {frame.module&&<p className="muted">Module: {frame.module}{frame.package?` · Package: ${frame.package}`:''}</p>}
  {(frame.context_line||frame.pre_context?.length||frame.post_context?.length)&&<div className="sdk-context"><p>Source context sent by SDK · separate from source-map lookup</p><pre>{[...(frame.pre_context??[]),frame.context_line??'',...(frame.post_context??[])].join('\n')}</pre></div>}
  {frame.vars&&<details><summary>Local variables · sent by SDK</summary>{Object.entries(frame.vars).map(([key,value])=><details key={key}><summary><code>{key}</code></summary><pre>{JSON.stringify(value,null,2)}</pre></details>)}</details>}
 </>;
 return <li>{(classification?classification.inApp===false:frame.in_app===false)?<details><summary>Library frame · not in app</summary>{content}</details>:content}</li>;
}
function Exception({exception,index,children,classification}:{exception:any;index:number;children?:any;classification?:any}) {
 return <article className="exception"><h3>{exception.type??'Error'}: {exception.value??''} {index===0&&!exception.mechanism?.is_exception_group&&<small>Root cause</small>}</h3>
  {exception.mechanism&&<p className="muted">{exception.mechanism.type??'Reported exception'} · {exception.mechanism.handled===false?'Unhandled':exception.mechanism.handled===true?'Handled':'Handling unknown'}{exception.mechanism.is_exception_group?' · Exception group':''}</p>}
  {exception.stacktrace?.frames?.length?<ol className="exception-stack">{exception.stacktrace.frames.map((frame:any,i:number)=><Frame key={i} frame={frame} index={i} classification={classification?.frames?.[i]}/>)}</ol>:<p>No stack sent for this exception.</p>}
  {children&&<div className="exception-children">{children}</div>}
 </article>;
}
export function SentryEvent({data,grouping}:{data:any;grouping:any}) {
 const [copied,setCopied]=useState(false),[failure,setFailure]=useState('');
 const exceptions=data.exceptions??[],seen=new Set<number>();
 const tree=(index:number):any=>{if(seen.has(index))return null;seen.add(index);const exception=exceptions[index],id=exception.mechanism?.exception_id;const children=id===undefined?[]:exceptions.flatMap((e:any,i:number)=>e.mechanism?.parent_id===id&&i!==index?[i]:[]);return <Exception key={index} exception={exception} index={index} classification={grouping?.exceptions?.[index]}>{children.map(tree)}</Exception>};
 const roots=exceptions.flatMap((e:any,i:number)=>e.mechanism?.parent_id===undefined||!exceptions.some((p:any)=>p.mechanism?.exception_id===e.mechanism.parent_id)?[i]:[]);
 const trees=roots.map(tree);trees.push(...exceptions.map((_:any,i:number)=>tree(i)));
 const raw=rawStack(data),sections=['tags','contexts','request','extra','threads','breadcrumbs','sdk','modules','debug_meta','_meta'];
 return <div className="event-diagnostic">
  <h2>Related Exceptions</h2>{exceptions.length?trees:<><h3>{data.logentry?.formatted??data.message??'Message event'}</h3>{data.stacktrace?.frames&&<ol className="exception-stack">{data.stacktrace.frames.map((f:any,i:number)=><Frame key={i} frame={f} index={i} classification={grouping?.stack?.[i]}/>)}</ol>}</>}
  {!!data.truncation?.length&&<div className="callout"><h3>Reported capture bounds</h3><ul>{data.truncation.map((t:any,i:number)=><li key={i}>{t.path}: {t.omitted?`${t.omitted} ${t.reason==='value_bytes'?'bytes':t.reason.includes('frames')?'frames':'values'} omitted · `:''}{t.reason}</li>)}</ul></div>}
  <Details title="Raw stack trace" triggerLabel="Raw stack trace"><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(raw);setCopied(true);setFailure('')}catch{setFailure('Clipboard access was refused. Select and copy the text below.')}}}>{copied?'Stack trace copied':'Copy raw stack trace'}</button>{failure&&<p role="alert">{failure}</p>}<pre>{raw}</pre></Details>
  <Details title="Event grouping information" triggerLabel="Grouping information"><p>Algorithm: <code>{grouping?.algorithm??'sentry-chain-v1'}</code></p><p>The rule variant and each contributing or excluded frame and value are listed below. In-app frames take precedence; hidden traceback frames never contribute. A project rule or SDK fingerprint can replace the default chain rule.</p><pre>{JSON.stringify(grouping,null,2)}</pre></Details>
  <div className="event-sections">{sections.filter(key=>data[key]!==undefined).map(key=><details key={key}><summary>{key==='_meta'?'SDK trimming and filtering remarks':key[0].toUpperCase()+key.slice(1)}</summary><pre>{JSON.stringify(data[key],null,2)}</pre></details>)}</div>
 </div>;
}
