import {useEffect,useState} from 'react';
import type { Issue } from './attention';
import { stateLabel, type Request, type Run } from './shared';

export function Priority({ project, issue, request, run, busy, refresh, readOnly = false }: {
  project: string; issue: Pick<Issue, 'id' | 'revision' | 'priority'>; request: Request; run: Run; busy: boolean; refresh: () => void; readOnly?: boolean;
}) {
  const root=`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue.id)}/priority`;
  const [current,setCurrent]=useState<{priority:string;version:string}|null>(null);
  useEffect(()=>{
    let alive=true;setCurrent(null);
    if(!readOnly)request(root).then(row=>{if(alive)setCurrent(row)}).catch(()=>{if(alive)setCurrent(null)});
    return ()=>{alive=false};
  },[root,issue.priority,request,readOnly]);
  if (readOnly) return <span className={`priority-chip ${issue.priority}`}>Priority: {stateLabel(issue.priority)}</span>;
  return <label className="form-field">Priority<select aria-label="Priority" value={current?.priority??issue.priority} disabled={busy||!current} onChange={event => {
    const priority = event.target.value;
    void run(async () => {
      try{setCurrent(await request(root, 'PUT', { priority, version:current!.version }));refresh()}
      catch(error){setCurrent(await request(root));throw error}
    });
  }}>
    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
  </select></label>;
}
