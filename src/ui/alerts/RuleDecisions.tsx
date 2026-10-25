import {useEffect,useState} from 'react';
import {alertApi,date} from './client';
import {RulePreview} from './RulePreview';
export function RuleDecisions({project,rules}:{project:string;rules:any[]}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;alertApi(`/api/projects/${project}/alerting/decisions`).then(value=>{if(active)setRows(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[project,rules]);
 if(error)return <p role="alert">{error}</p>;
 return <details><summary>Recorded window decisions ({rows.length})</summary>{rows.map(row=>{const rule=rules.find(r=>r.id===row.rule_id),decision=JSON.parse(row.reason);return <section key={row.id}><h3>{rule?.name??'Previous rule'} · {row.fired?'Fired':'Withheld'} · {date(row.end)}</h3><RulePreview preview={{token:null,refusal:null,owner:'Installation owner',destination:rule?.destination??'Previous destination',window:{from:row.start,to:row.end,durationMs:row.end-row.start},matchedEvents:decision.count,transitions:[],decisions:[decision]}}/></section>})}</details>;
}
