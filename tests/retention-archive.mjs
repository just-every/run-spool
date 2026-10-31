import assert from 'node:assert/strict';
import {archiveProjection} from './archive.mjs';
import {archiveText} from './agent-handoff/caps.mjs';

// Age a bounded public archive, keeping its captured payloads and occurrence
// identities. The empty destination's restore door validates the whole corpus.
export async function agedRetentionArchive(response,project,held,now){
 const snapshot=await archiveProjection(response),data=structuredClone(snapshot.data);
 const old=now-91*86400000,recent=now-86400000;
 const recentIds=['synthetic-spool-60','synthetic-spool-61'];
 const agedIds=Array.from({length:60},(_,n)=>'synthetic-spool-'+n);
 assert.equal(data.events.filter(row=>row.project===project).length,62);
 assert.equal(data.events.filter(row=>row.project===held).length,1);
 for(const row of data.events)row.received=row.project===project&&recentIds.includes(row.id)?recent:old;
 for(const row of data.issues){row.first_seen=old;row.last_seen=row.project===project?recent:old;}
 for(const row of data.commits)row.received=old;
 return {text:await archiveText(snapshot,data),agedIds,recentIds,events:data.events};
}
