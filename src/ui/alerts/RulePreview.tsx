import {date,status} from './client';
import {destinationLabel,installationOwner} from './RuleSummary';
import {receiptLabel} from '../workbench/CaptureReceipts';
import {useDestination} from '../workbench/location';
export type Sample={start?:number;end?:number;issue?:string;issue_short_id?:string;issue_title?:string;count?:number;reason?:string;metric?:string;value?:number|null;baseline?:number|null;threshold?:number;fired?:boolean;history?:Sample[];excluded?:Sample[];loss?:Sample[];reasons?:string[];[key:string]:any};
export type Preview={token:string|null;refusal:string|null;owner:string;destination:string;window:{from:number;to:number;durationMs:number};transitions:Sample[];matchedEvents:number;decisions:Sample[];coverage?:string};
const rate=(value:number|null|undefined)=>value==null?'unavailable':value.toFixed(4);
const plainReason=(reason:string)=>{const discarded=/^client_discarded:([^:]+):([^:]+)$/.exec(reason);return discarded?`${status(discarded[1])} · ${status(discarded[2])}`:receiptLabel(reason)};
export function DecisionRow({sample,project,ruleName}:{sample:Sample;project:string;ruleName?:string}){
 const route=useDestination(),metric=sample.metric;
 const measurement=metric==='baseline'?`${sample.reason?.startsWith('Sample-scaled issue rate')?'':`Current rate ${rate(sample.value)} · baseline ${rate(sample.baseline)} × ${sample.threshold} · `}${sample.denominator} project events · sample rate ${sample.sampleRate}`:'';
 const extra=sample.start!==undefined||!!(sample.history?.length||sample.excluded?.length||sample.loss?.length);

 return <li><div>
 <strong>{sample.issue_short_id} {sample.issue_title??'Removed issue'}</strong>
 <p className="muted">{ruleName&&`${ruleName} · `}{sample.fired?'Fired':'Withheld'} · {sample.reason&&status(sample.reason)}{measurement&&` · ${measurement}`}{sample.end!==undefined&&` · ${date(sample.end)}`}</p>
 {extra&&<details><summary>Decision details</summary>
 {sample.start!==undefined&&sample.end!==undefined&&<p>{date(sample.start)} – {date(sample.end)}</p>}
 {sample.history?.map((row,index)=><p key={'h'+index}>{date(row.start!)} · comparable rate {rate(row.rate)}</p>)}
 {sample.excluded?.map((row,index)=><p key={'e'+index}>{date(row.start!)} · excluded: {row.reasons?.map(plainReason).join(', ')}</p>)}
 {sample.loss?.map((row,index)=><p key={'l'+index}>{plainReason(row.reason!)} · {row.count} events</p>)}
 </details>}
 </div>{sample.issue&&<button type="button" className="text-button" onClick={()=>route.go(project,'issues',sample.issue)}>Open issue</button>}</li>;
}
export function RulePreview({preview,project,destinations}:{preview:Preview;project:string;destinations:any[]}){
 return <section aria-label="Rule preview" style={{gridColumn:'1 / -1',minWidth:0}}>
 <h3>Rule preview</h3>
 <p>{installationOwner} · {destinationLabel(destinations.find(destination=>destination.id===preview.destination))}</p>
 <p>{date(preview.window.from)} – {date(preview.window.to)} · {preview.window.durationMs/60000} minute windows · {preview.matchedEvents} matching accepted events</p>
 {preview.refusal&&<p role="alert" className="callout">{status(preview.refusal)}</p>}
 <h4>Matching transitions ({preview.transitions.length})</h4>
 {preview.transitions.length?<ul className="alert-records">{preview.transitions.map((sample,index)=><DecisionRow key={index} {...{sample,project}}/>)}</ul>:<p>No transitions in this sample.</p>}
 {!!preview.decisions.length&&<details><summary>Window decisions ({preview.decisions.length})</summary><ul className="alert-records">{preview.decisions.map((sample,index)=><DecisionRow key={index} {...{sample,project}}/>)}</ul></details>}
 </section>;
}
