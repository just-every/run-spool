import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),load=file=>import(pathToFileURL(resolve(root,file)));
const {startTestWorker}=await load('tests/worker.mjs');
const {signIn}=await load('tests/auth.mjs');
const {archiveProjection}=await load('tests/archive.mjs');
const {beforeRelayPrivacy,beforeTombstoneTables,rebuiltArchive}=await load('tests/fixtures/archive-before-relay-privacy.mjs');
let source,destination;
try{
 source=await startTestWorker(15592);
 const sc=await signIn(source.origin);
 const request=(origin,cookie,path,method='GET',body)=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,...body?{'X-Confirm-Restore':'yes'}:{}},...body?{body}:{} });
 const snapshot=await archiveProjection(await request(source.origin,sc,'/api/archive'));
 console.log(JSON.stringify({feedback:snapshot.manifest.tables.find(t=>t.name==='feedback'),migrations:snapshot.manifest.migrations?.slice(-12)}));
 for(const [name,edit,options] of [['previousRelayPrivacy',beforeRelayPrivacy,{}],['previousTombstoneTables',beforeTombstoneTables,{objectIdentity:true}]]){
  destination=await startTestWorker(15593);const dc=await signIn(destination.origin);
  const text=await rebuiltArchive(snapshot.text,edit,options),rewritten=await archiveProjection(new Response(text));
  console.log(JSON.stringify({case:name,feedback:rewritten.manifest.tables.find(t=>t.name==='feedback'),migrations:rewritten.manifest.migrations?.slice(-12)}));
  const r=await request(destination.origin,dc,'/api/restore','POST',text);
  console.log(JSON.stringify({case:name,status:r.status,body:await r.text()}));
  await destination.stop();destination=null;
 }
}finally{await destination?.stop();await source?.stop()}
