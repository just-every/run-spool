import { Field } from '../workbench/shared';
export type MetricDraft={dataset:'errors'|'transactions'|'sessions';thresholdType:'above'|'below';critical:string;warning:string;resolve:string;transaction:string};
export const initialMetric:MetricDraft={dataset:'errors',thresholdType:'above',critical:'100',warning:'50',resolve:'25',transaction:''};
export function MetricFields({value,onChange,disabled}:{value:MetricDraft;onChange:(v:MetricDraft)=>void;disabled:boolean}){
 const set=(patch:Partial<MetricDraft>)=>onChange({...value,...patch});
 return <>
 <label className="form-field">Project metric<select aria-label="Project metric" value={value.dataset} disabled={disabled} onChange={e=>set({dataset:e.target.value as MetricDraft['dataset'],...(e.target.value==='sessions'?{thresholdType:'below',critical:'99',warning:'99.5',resolve:'99.8'}:{thresholdType:'above',critical:'100',warning:'50',resolve:'25'})})}><option value="errors">Error count</option><option value="transactions">p95 transaction duration (ms)</option><option value="sessions">Crash-free session rate (%)</option></select></label>
 <label className="form-field">Threshold comparison<select aria-label="Threshold comparison" value={value.thresholdType} disabled={disabled} onChange={e=>set({thresholdType:e.target.value as MetricDraft['thresholdType']})}><option value="above">Above</option><option value="below">Below</option></select></label>
 {(['critical','warning','resolve'] as const).map(key=><Field key={key} label={`${key[0].toUpperCase()+key.slice(1)} threshold${key==='critical'?'':' (optional)'}`} type="number" step="any" required={key==='critical'} value={value[key]} disabled={disabled} onChange={e=>set({[key]:e.target.value})}/>)}
 {value.dataset==='transactions'&&<Field label="Transaction pattern" placeholder="/v1/*" value={value.transaction} disabled={disabled} onChange={e=>set({transaction:e.target.value})}/>}
 </>;
}
