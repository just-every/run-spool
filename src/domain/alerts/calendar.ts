// Calendar keys, not elapsed 24-hour intervals, arbitrate DST scheduler ticks.
export function timezone(value:unknown):string {
 if(typeof value!=='string'||value.length>100||!/^(?:UTC|GMT|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/.test(value))throw new Error('Use a valid IANA timezone');
 try {return new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone}catch{throw new Error('Use a valid IANA timezone')}
}
export function localDate(time:number,zone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(time);
 const field=(name:string)=>parts.find(p=>p.type===name)!.value;
 return {date:`${field('year')}-${field('month')}-${field('day')}`,hour:Number(field('hour'))};
}
export function shiftDay(date:string,days:number){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)}
export function midnight(date:string,zone:string){
 const target=Date.parse(date+'T00:00:00Z');let instant=target;
 for(let n=0;n<4;n++){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const f=(name:string)=>parts.find(p=>p.type===name)!.value;
  const wall=Date.parse(`${f('year')}-${f('month')}-${f('day')}T${f('hour')}:${f('minute')}:${f('second')}Z`);
  const next=instant+target-wall;if(next===instant)break;instant=next;
 }return instant;
}
export function digestPeriod(time:number,zone:string,kind:string,hour:number){
 const local=localDate(time,zone);let end=local.hour>=hour?local.date:shiftDay(local.date,-1);
 if(kind==='weekly'){const weekday=new Date(end+'T12:00:00Z').getUTCDay();end=shiftDay(end,-((weekday+6)%7))}
 const start=shiftDay(end,kind==='weekly'?-7:-1);
 return {key:start+'..'+end,start:midnight(start,zone),end:midnight(end,zone),due:midnight(end,zone)+hour*3600000};
}
