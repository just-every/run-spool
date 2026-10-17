import { useEffect, useState } from 'react';
import { api } from './client';
export function useIssueSearch(project:string,params:string,refresh:unknown){
 const key=project+'?'+params;
 const [answer,setAnswer]=useState<{key:string;value:any}|null>(null),[failure,setFailure]=useState<{key:string;message:string}|null>(null),[pending,setPending]=useState(true);
 useEffect(()=>{
  let alive=true;setPending(true);setFailure(null);
  const timer=setTimeout(()=>{api(`/api/projects/${encodeURIComponent(project)}/issue-search?${params}`).then(value=>{if(alive){setAnswer({key,value});setPending(false)}}).catch(error=>{if(alive){setFailure({key,message:error.message});setPending(false)}})},180);
  return ()=>{alive=false;clearTimeout(timer)};
 },[project,params,refresh]);
 const result=answer?.key===key?answer.value:null,failed=failure?.key===key?failure.message:'';
 return {result,failed,loading:!result&&!failed,refreshing:pending&&!!result};
}
