import {useEffect,useState} from 'react';
import {alertApi} from './client';
import {DecisionRow} from './RulePreview';
export function RuleDecisions({project,rules}:{project:string;rules:any[]}){
 const [rows,setRows]=useState<any[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;alertApi(`/api/projects/${project}/alerting/decisions`).then(value=>{if(active)setRows(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[project,rules]);
 if(error)return <p role="alert">Recorded decisions could not be loaded. Open Rules again to retry.</p>;
 return <details><summary>Recorded window decisions{rows?` (${rows.length})`:''}</summary><ul className="alert-records">{rows?.map(row=><DecisionRow key={row.id} project={project} ruleName={rules.find(rule=>rule.id===row.rule_id)?.name??'Removed rule'} sample={{...JSON.parse(row.reason),issue:row.issue,issue_short_id:row.issue_short_id,issue_title:row.issue_title,fired:!!row.fired}}/>)}</ul></details>;
}
