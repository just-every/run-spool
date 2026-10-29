import type {ReportIssue} from './types';

export function reportOwnership(projects:{id:string;team:string|null}[],issues:ReportIssue[],to:number){
 const rows=projects.map(p=>{
  const selected=issues.filter(i=>i.project===p.id&&i.first_seen<to),labels=new Map<string,number>();
  for(const issue of selected)if(issue.label)labels.set(issue.label,(labels.get(issue.label)??0)+1);
  const owned=[...labels.values()].reduce((n,count)=>n+count,0);
  return {project:p.id,team:p.team,issues:selected.length,owned,unowned:selected.length-owned,labels:[...labels.entries()].map(([label,issues])=>({label,issues})).sort((a,b)=>a.label.localeCompare(b.label))};
 });
 const teams=new Map<string|null,{team:string|null;projects:number;issues:number;owned:number;unowned:number}>();
 for(const row of rows){const team=teams.get(row.team)??{team:row.team,projects:0,issues:0,owned:0,unowned:0};team.projects++;team.issues+=row.issues;team.owned+=row.owned;team.unowned+=row.unowned;teams.set(row.team,team)}
 return {rows,teams:[...teams.values()],issues:rows.reduce((n,r)=>n+r.issues,0),owned:rows.reduce((n,r)=>n+r.owned,0),unowned:rows.reduce((n,r)=>n+r.unowned,0),
  method:'Current assignment labels and project teams for retained issues first seen before the window end. Unowned includes absent and cleared assignments. Includes every issue state; this is current responsibility, not historical assignment at a boundary or an authenticated member count.'};
}
