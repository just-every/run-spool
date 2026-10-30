import {releaseHealth} from '../sessions/health';
import {reportWindow,reportBuckets,reportBucketAt} from './window';
import {reportProjects,readReport} from './read';
import {reportHistory} from './history';
import {reportCoverage} from './coverage';
import {reportUsers} from './users';
import {reportOwnership} from './ownership';
import {releaseOrderRanks} from '../releases/policy';
import type {ReportInput} from './types';
export type {ReportInput} from './types';

/** Caller supplies the currently authorized project IDs. This function never
 * broadens them and performs no authentication or persistence of its own. */
export async function computeReport(db:D1Database,projects:string[],input:ReportInput){
 const window=reportWindow(input),selected=await reportProjects(db,projects,input.team),ids=selected.map(p=>p.id),generatedAt=Date.now();
 const data=await readReport(db,ids,input),buckets=reportBuckets(window),history=reportHistory(data,input,buckets);
 const [users,metadata,health]=await Promise.all([
  reportUsers(db,ids,data.events),reportCoverage(db,ids,data,input,generatedAt),
  Promise.all(ids.map(project=>releaseHealth(db,project,input.from,input.to,null))),
 ]);
 for(const event of data.events)reportBucketAt(buckets,event.received)!.events++;
 const named=new Map<string,{project:string;release:string;events:number}>();
 for(const event of data.events)if(event.release){const key=JSON.stringify([event.project,event.release]),row=named.get(key)??{project:event.project,release:event.release,events:0};row.events++;named.set(key,row)}
 const noReleaseEvents=data.events.filter(e=>!e.release).length;
 const releaseRanks=new Map(await Promise.all(ids.map(async project=>[project,await releaseOrderRanks(db,project)] as const)));
 return {version:1,generatedAt,window,scope:{projects:ids,team:input.team??null},
  volume:{events:data.events.length,issues:new Set(data.events.map(e=>JSON.stringify([e.project,e.issue]))).size,affectedUsers:users.affectedUsers,unattributedEvents:users.unattributedEvents,noReleaseEvents,sessions:health.reduce((n,p)=>n+p.denominators.sessionsSeen,0),ratePerHour:data.events.length*3600000/(input.to-input.from)},
  buckets,...history,ownership:reportOwnership(selected,data.issues,input.to),users,
  releaseStability:{rows:health.flatMap(p=>p.rows.map(row=>({project:p.project,...row}))),projects:health,
   errorRows:[...named.values()].sort((a,b)=>a.project.localeCompare(b.project)||releaseRanks.get(a.project)!.get(a.release)!-releaseRanks.get(b.project)!.get(b.release)!),noReleaseEvents,
   method:'SDK-005 observed release health, with project-qualified rows and its original uncertainty and denominator notes. Error rows count retained named-release errors only; no-release errors are counted separately and remain in total volume. Session start times and error receipt times are distinct; no causal or rollout inference.'},
  metadata};
}
