import {readArchive,makePart} from '../../modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier,checkPart} from '../../modules/portability/format.mjs';
import {canonicalJson} from '../../modules/portability/hash.mjs';
import {compareReleases} from './order';
import {defaultReleasePolicy,validateReleasePolicy,type ReleasePolicy} from './policy';
type Snapshot={source:string;rows:any[];closing?:any};

/** Base owns the immutable snapshot and transfer fences. Only the release row
 * presentation changes; row identities, table inventory and private data stay
 * in that snapshot. All parts and both archive digests are verified again. */
export function orderedReleaseExports(exports:any){
 const cache=new Map<string,Snapshot>();
 const snapshot=async(id:string,status:any):Promise<Snapshot>=>{
  const prior=cache.get(id);if(prior&&prior.source===status.contentHash)return prior;
  const metadata=new Map<string,number>(),policies=new Map<string,ReleasePolicy>(),rows:any[]=[];
  const key=(project:string,name:string)=>JSON.stringify([project,name]);
  for await(const record of readArchive(await exports.download(id))){
   if(record.kind!=='part')continue;
   for(const item of record.items as any[]){
    if(item.kind!=='row')continue;
    if(item.table==='release_metadata')metadata.set(key(item.row.project,item.row.release),item.row.first_seen);
    if(item.table==='release_policies')policies.set(item.row.project,validateReleasePolicy(JSON.parse(item.row.policy)));
    if(item.table==='releases')rows.push(item);
   }
  }
  rows.sort((a,b)=>a.row.project<b.row.project?-1:a.row.project>b.row.project?1:compareReleases(
   {...a.row,first_seen:metadata.get(key(a.row.project,a.row.name))},
   {...b.row,first_seen:metadata.get(key(b.row.project,b.row.name))},
   (policies.get(a.row.project)??defaultReleasePolicy()).order));
  const result:Snapshot={source:status.contentHash,rows};cache.set(id,result);return result;
 };
 const records=async function*(id:string,saved:Awaited<ReturnType<typeof snapshot>>){
  let offset=0,content:any,binding:any;
  for await(const record of readArchive(await exports.download(id))){
   if(record.kind==='manifest'){content=new ContentVerifier(record);binding=new ArchiveVerifier(record);yield record;continue}
   if(record.kind==='closing'){
    if(offset!==saved.rows.length)throw new Error('Release archive inventory changed');
    const closing={...record,contentHash:content.digest(),archiveHash:binding.digest()};saved.closing=closing;yield closing;continue;
   }
   const items=record.items.map((item:any)=>item.kind==='row'&&item.table==='releases'?{...saved.rows[offset++],index:item.index}:item);
   const part=await makePart(record.index,items);await checkPart(part,record.index);
   binding.add(part);for(const item of items)content.add(item);yield part;
  }
 };
 const decorate=async(status:any)=>{
  if(status.phase!=='complete')return status;
  const saved=await snapshot(status.id,status);
  if(!saved.closing)for await(const _ of records(status.id,saved)){}
  return {...status,contentHash:saved.closing.contentHash};
 };
 return {...exports,
  advance:async(id:string,options:any)=>decorate(await exports.advance(id,options)),
  status:async(id:string)=>decorate(await exports.status(id)),
  abort:async(id:string)=>{cache.delete(id);return exports.abort(id)},
  download:async(id:string)=>{
   const status=await exports.status(id),saved=await snapshot(id,status),iterator=records(id,saved),encoder=new TextEncoder();
   return new ReadableStream<Uint8Array>({
    async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(canonicalJson(next.value)+'\n'))}catch(error){controller.error(error)}},
    async cancel(){await iterator.return(undefined)},
   });
  },
 };
}
