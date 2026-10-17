import { useEffect, useState } from 'react';
import { api } from './client';
export function useIssueSearch(project:string,params:string,refresh:unknown){
 const [result,setResult]=useState<any>(null),[failed,setFailed]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let alive=true;setLoading(true);setFailed('');
  const timer=setTimeout(()=>{api(`/api/projects/${encodeURIComponent(project)}/issue-search?${params}`).then(value=>{if(alive){setResult(value);setLoading(false)}}).catch(error=>{if(alive){setFailed(error.message);setLoading(false)}})},180);
  return ()=>{alive=false;clearTimeout(timer)};
 },[project,params,refresh]);
 return {result,failed,loading};
}
