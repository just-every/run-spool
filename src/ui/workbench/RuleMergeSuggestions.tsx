import { useRef, useState } from 'react';
import { useLiveRead } from './useLiveRead';
import { Details } from './Details';
import { CorrectionReview, type CorrectionPreview } from './OperatorPanel';
import type { Request, Run } from './shared';

export function RuleMergeSuggestions({project,source,request,run,busy,refresh,version=0}: {project:string;source?:string;request:Request;run:Run;busy:boolean;refresh:()=>void;version?:number}) {
  const [rows,setRows]=useState<any[]>([]),[preview,setPreview]=useState<CorrectionPreview|null>(null),[failure,setFailure]=useState('');
  const root=`/api/projects/${encodeURIComponent(project)}`;
  const generation=useRef(0), endpoint=root+'/grouping-rules/merge-suggestions'+(source?'?issue='+encodeURIComponent(source):'');
  const load=async()=>{generation.current++;setRows(await request(endpoint));};
  useLiveRead(async signal=>{const started=generation.current;try{const result=await request(endpoint);if(!signal.aborted&&started===generation.current)setRows(result);}catch(error){if(!signal.aborted&&started===generation.current)setFailure((error as Error).message);}},[endpoint,version,request]);
  const act=(work:()=>Promise<void>)=>void run(async()=>{setFailure('');try{await work();}catch(error){setFailure((error as Error).message);}});
  if(!rows.length&&!failure)return null;
  return <div className="rule-merge-suggestions"><h3>Existing groups after rule changes</h3>
    <button className="text-button" disabled={busy} onClick={()=>act(load)}>Refresh merge offers</button>
    {failure&&<p role="alert">{failure}</p>}
    {rows.map(row=><div className="callout" key={row.source.id+':'+(row.target?.id??'waiting')}>
      <p>Rule revision {row.ruleRevision} changes future grouping for <a href={`/projects/${project}/issues/${row.source.short_id}`}>{row.source.short_id}</a>: {row.source.title}.</p>
      {row.target?<><p>The new group is <a href={`/projects/${project}/issues/${row.target.short_id}`}>{row.target.short_id}</a>. Review merging {row.source.count} earlier occurrences so one issue remains.</p>
        <Details title={`Merge ${row.source.short_id} into ${row.target.short_id}`} triggerLabel={`Review merge into ${row.target.short_id}`} triggerName={`Review merge into ${row.target.short_id}`} onOpen={()=>{setPreview(null);act(async()=>setPreview(await request(root+'/corrections/preview','POST',{kind:'merge',source:row.source.short_id,revision:row.source.revision,target:row.target.short_id,targetRevision:row.target.revision})));}}>
          {failure&&<p role="alert">{failure}</p>}
          {preview&&<CorrectionReview {...{preview,busy}} onCancel={()=>setPreview(null)} onApply={()=>act(async()=>{await request(root+'/corrections/'+preview.id+'/apply','POST',{confirm:true});setPreview(null);await load();refresh();})}/>}
        </Details>
      </>:<p>Earlier occurrences stay in this group. After the next matching error, return here to review merging it into the new group.</p>}
    </div>)}
  </div>;
}
