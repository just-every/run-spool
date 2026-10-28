import {timezone} from '../alerts/calendar';
import type {ReportInput,ReportBucket} from './types';

export function reportWindow(input:ReportInput) {
 if(!input||Object.keys(input).some(k=>!['from','to','timeZone','team'].includes(k))||!Number.isSafeInteger(input.from)||!Number.isSafeInteger(input.to)||input.from<0||input.to<=input.from||input.to-input.from>90*86400000||input.to>Date.now()+300000)throw new Error('Use a positive report window of at most 90 days');
 if(input.team!==undefined&&(typeof input.team!=='string'||!input.team.trim()||input.team.length>80||/[\x00-\x1f\x7f]/.test(input.team)))throw new Error('Use a bounded team name');
 return {from:input.from,to:input.to,timeZone:timezone(input.timeZone),bucket:'day' as const};
}

/** Find calendar-date changes in actual instants. This also handles zones whose
 * clock changes at midnight, including dates with no midnight or a skipped day. */
export function reportBuckets(window:ReturnType<typeof reportWindow>):ReportBucket[] {
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:window.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const date=(at:number)=>{const p=formatter.formatToParts(at),get=(type:string)=>p.find(part=>part.type===type)!.value;return `${get('year')}-${get('month')}-${get('day')}`};
 const rows:ReportBucket[]=[];let start=window.from;
 while(start<window.to){
  const label=date(start);let low=start,high=Math.min(start+3600000,window.to);
  while(high<window.to&&date(high)===label){low=high;high=Math.min(high+3600000,window.to)}
  if(date(high-1)===label&&high===window.to){rows.push({from:start,to:high,label,events:0,newIssues:0,regressions:0,resolutions:0});break}
  while(high-low>1){const middle=Math.floor((low+high)/2);if(date(middle)===label)low=middle;else high=middle}
  rows.push({from:start,to:high,label,events:0,newIssues:0,regressions:0,resolutions:0});start=high;
 }
 return rows;
}
export function reportBucketAt(rows:ReportBucket[],at:number){return rows.find(row=>row.from<=at&&at<row.to)}
