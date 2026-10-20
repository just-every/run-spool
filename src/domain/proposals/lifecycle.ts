import { canonical } from '../privacy';
import { guard, s } from '../operators/common';
export const revisionGuards=(db:D1Database,project:string,revisions:any[])=>revisions.map(r=>guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',project,r.id,r.revision));
export async function proposalStale(db:D1Database,row:any){
 const revisions=JSON.parse(row.revisions),input=JSON.parse(row.input);
 for(const r of revisions){const issue=await s(db,'SELECT revision FROM issues WHERE project=? AND id=?',row.project,r.id).first<any>();if(!issue||issue.revision!==r.revision)return true;}
 if(input.kind==='rule'){const p=await s(db,'SELECT revision FROM grouping_policies WHERE project=?',row.project).first<any>();if((p?.revision??0)!==input.policyRevision)return true;}
 if(row.state==='approved'&&row.kind!=='rule'&&!await s(db,"SELECT 1 FROM grouping_corrections WHERE project=? AND id=? AND state='preview'",row.project,row.correction).first())return true;
 return false;
}
export async function ruleProposalStatements(db:D1Database,project:string,policy:any,revision:number){
 const rows=(await s(db,"SELECT * FROM grouping_proposals WHERE project=? AND kind='rule' AND state IN ('approved','applied')",project).all<any>()).results,jobs:D1PreparedStatement[]=[];
 for(const row of rows){
  const input=JSON.parse(row.input);
  if(row.state==='approved'&&canonical(input.policy)===canonical(policy)){
   if(input.policyRevision!==revision||await proposalStale(db,row))throw new Error('Proposal issue revision conflict');
   jobs.push(guard(db,'EXISTS(SELECT 1 FROM grouping_policies WHERE project=? AND revision=?)',project,revision+1),...revisionGuards(db,project,JSON.parse(row.revisions)),s(db,"UPDATE grouping_proposals SET state='applied',rule_revision=?,updated=? WHERE project=? AND id=?",revision+1,Date.now(),project,row.id));
  }else if(row.state==='applied'){
   const previous=row.rule_revision===1?{version:1,stack:'',fingerprint:''}:JSON.parse((await s(db,"SELECT detail FROM audit WHERE project=? AND kind='grouping_rules_changed' AND json_extract(detail,'$.revision')=?",project,row.rule_revision-1).first<any>())?.detail??'{}').policy;
   if(previous&&canonical(previous)===canonical(policy))jobs.push(s(db,"UPDATE grouping_proposals SET state='undone',updated=? WHERE project=? AND id=?",Date.now(),project,row.id));
  }
 }
 if(jobs.length){jobs.unshift(guard(db,'EXISTS(SELECT 1 FROM grouping_policies WHERE project=? AND revision=?)',project,revision+1));jobs.push(s(db,'DELETE FROM operator_guards'));}
 return jobs;
}
