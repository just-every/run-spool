import { sourceDiagnostics } from './path-mappings';
import { AnyMap, originalPositionFor, decodedMappings, traceSegment } from '@jridgewell/trace-mapping';
import { scrub, type Envelope } from './privacy';
import { sourceMapFile } from './source-map-path';
import { functionScopes, type FunctionScopes } from './source-map-functions';
import { artifactNameKey, frameArtifactNames } from './sentry-cli/names';
export const sourceMapByteLimit = 1024 * 1024;
export function validateMap(map:any): string {
 const text=JSON.stringify(map),bytes=text?new TextEncoder().encode(text).length:0;
 if(!text||bytes>sourceMapByteLimit)throw new Error('Map exceeds 1 MiB');
 // Every flat map admitted by the previous parser keeps its path grammar.
 const legacyFlat=map?.version===3&&!('sections' in map)&&bytes<=262144&&Array.isArray(map.sources)&&map.sources.length<=100&&Array.isArray(map.names)&&map.names.length<=10000&&typeof map.mappings==='string'&&map.mappings.length<=131072&&map.mappings.split(';').length<=10000&&map.mappings.split(',').length<=20000;
 let sources=0,names=0,sections=0,segments=0,lines=0,mappingBytes=0;
 const bounded=(value:any)=>Number.isSafeInteger(value)&&value>=0&&value<=10000000;
 function check(input:any,depth=0,baseLine=0){
  if(!input||input.version!==3||depth>4||(!legacyFlat&&input.file!==undefined&&(typeof input.file!=='string'||input.file.length>2048)))throw new Error('Unsupported Source Map V3');
  if('sections' in input){
   if(!Array.isArray(input.sections)||!input.sections.length||Object.keys(input).some(k=>!['version','file','sections'].includes(k)))throw new Error('Invalid indexed map');
   let previous={line:-1,column:0};
   for(const section of input.sections){
    if(++sections>128||!section||Object.keys(section).sort().join()!=='map,offset'||!section.offset||Object.keys(section.offset).sort().join()!=='column,line'||!bounded(section.offset.line)||!bounded(section.offset.column)||baseLine+section.offset.line>=20000||section.offset.line<previous.line||(section.offset.line===previous.line&&section.offset.column<=previous.column))throw new Error('Invalid indexed map offset or parser budget');
    previous=section.offset;check(section.map,depth+1,baseLine+section.offset.line);
   }
   return;
  }
  if(!Array.isArray(input.sources)||!input.sources.length||input.sources.some((s:any)=>typeof s!=='string'||(!legacyFlat&&s.length>2048))||!Array.isArray(input.names)||input.names.some((s:any)=>typeof s!=='string')||typeof input.mappings!=='string'||(input.sourceRoot!==undefined&&(typeof input.sourceRoot!=='string'||(!legacyFlat&&input.sourceRoot.length>2048)))||Object.keys(input).some(k=>!['version','file','sourceRoot','sources','sourcesContent','names','mappings','ignoreList','x_google_ignoreList'].includes(k)))throw new Error('Unsupported Source Map V3');
  sources+=input.sources.length;names+=input.names.length;mappingBytes+=input.mappings.length;lines+=input.mappings.split(';').length;segments+=input.mappings.split(',').length;
  if(sources>1000||names>10000||mappingBytes>524288||lines>20000||segments>50000)throw new Error('Map parser budget');
  if((legacyFlat?Boolean(input.sourcesContent):input.sourcesContent!=null)&&(!Array.isArray(input.sourcesContent)||input.sourcesContent.some((s:any)=>s!==null&&typeof s!=='string')))throw new Error('Invalid source content');
  for(const key of ['ignoreList','x_google_ignoreList'])if(input[key]!==undefined&&(!Array.isArray(input[key])||input[key].some((i:any)=>!Number.isSafeInteger(i)||i<0||i>=input.sources.length)))throw new Error('Invalid ignore list');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for(const line of input.mappings.split(';')){
   if(!line)continue;
   for(const segment of line.split(',')){
    if(!segment)throw new Error('Empty map segment');
    let continuing=false,run=0,scalar=0,factor=1;
    for(const char of segment){const code=alphabet.indexOf(char);if(code<0)throw new Error('Invalid VLQ character');continuing=(code&32)!==0;run++;scalar+=(code&31)*factor;if(scalar>20000001||run>6)throw new Error('VLQ integer exceeds supported coordinate budget');if(!continuing){run=0;scalar=0;factor=1}else factor*=32;}
    if(continuing)throw new Error('Unterminated VLQ integer');
   }
  }
  checkCoordinates(new AnyMap(input));
 }
 function checkCoordinates(traced:ReturnType<typeof AnyMap>){
  const decoded=decodedMappings(traced);
  if(decoded.length>20000||decoded.reduce((total,line)=>total+line.length,0)>50000)throw new Error('Map parser budget');
  for(const line of decoded)for(const segment of line)if(![1,4,5].includes(segment.length)||segment.some(n=>!bounded(n))||(segment.length>=4&&(segment[1]!>=traced.sources.length||segment[2]!>=10000000))||(segment.length===5&&segment[4]!>=traced.names.length))throw new Error('Invalid decoded mapping');
 }
 check(map);checkCoordinates(new AnyMap(map));return text;
}
export async function diagnose(db:D1Database, project:string, event:Envelope): Promise<any[]> {
  return createDiagnoser(db,project)(event);
}
// Share only reads started by this diagnosis operation (or packet request).
// A new caller gets fresh artifact state, including maps uploaded since its last read.
export function createDiagnoser(db:D1Database, project:string) {
  const artifacts = new Map<string, Promise<any>>();
  const identities = new Map<string, Promise<any>>();
  const scopes = new Map<string, FunctionScopes>();
  const names = new Map<string, Promise<string|null>>();
  const named = new Map<string, Promise<boolean>>();
  const byName = (event:Envelope, file:string) => {
    const key = JSON.stringify([event.release,event.build,file]);
    if (!names.has(key)) names.set(key,(async()=>{
      // Most releases hold no URL-named map: one lookup per release and dist spares the per-file ones.
      const scope = JSON.stringify([event.release,event.build]);
      if (!named.has(scope)) named.set(scope,db.prepare("SELECT 1 FROM artifacts WHERE project=? AND release=? AND build=? AND debug LIKE 'url:%' LIMIT 1").bind(project,event.release,event.build).first().then(Boolean));
      if (!await named.get(scope)) return null;
      const candidates = await Promise.all(frameArtifactNames(file).map(artifactNameKey));
      if (!candidates.length) return null;
      const found = await db.prepare('SELECT debug FROM artifacts WHERE project=? AND release=? AND build=? AND debug IN (SELECT value FROM json_each(?)) ORDER BY debug LIMIT 1').bind(project,event.release,event.build,JSON.stringify(candidates)).first<{debug:string}>();
      return found?.debug ?? null;
    })());
    return names.get(key)!;
  };
  return async (event:Envelope): Promise<any[]> => {
    if (event.language) return sourceDiagnostics(db,project,event);
    const results=[];
    for(const frame of event.frames){results.push(await (async()=>{
      // Without a debug ID, a release/dist artifact named by the frame's file URL (`~/static/app.js`) identifies the map.
      const debugId = frame.debugId ?? await byName(event,frame.file);
      if(!debugId) return {generated:frame,status:'missing_debug_id'};
      const key = JSON.stringify([event.release,event.build,debugId]);
      if (!artifacts.has(key) && artifacts.size>=8) artifacts.delete(artifacts.keys().next().value!);
      if (!artifacts.has(key)) artifacts.set(key,db.prepare('SELECT payload,digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?').bind(project,event.release,event.build,debugId).first<any>());
      const row = await artifacts.get(key);
      if(!row) {
        if (!identities.has(debugId)) identities.set(debugId,db.prepare('SELECT 1 FROM artifacts WHERE project=? AND debug=?').bind(project,debugId).first());
        const elsewhere = await identities.get(debugId);
        return {generated:frame,status:elsewhere?'identity_mismatch':'missing_artifact'};
      }
      try {
        const map = JSON.parse(row.payload);
        const traced = new AnyMap(map), original = originalPositionFor(traced,{line:frame.line,column:frame.column!});
        if(original.line===null) return {generated:frame,status:'unmapped_position',artifactDigest:row.digest};
        const segment = traceSegment(traced,frame.line-1,frame.column!), sourceIndex = segment && segment.length >= 4 ? segment[1] : undefined;
        const source = sourceIndex === undefined ? null : traced.sourcesContent?.[sourceIndex];
        let name: string | null = null;
        if (typeof source === 'string') {
          const key = `${row.digest}:${sourceIndex}`;
          if (!scopes.has(key) && scopes.size>=8) scopes.delete(scopes.keys().next().value!);
          if (!scopes.has(key)) scopes.set(key,functionScopes(source,sourceMapFile(original.source??'')));
          name = scopes.get(key)!(original.line,original.column!);
        }
        return {generated:frame,status:'mapped',original:{file:sourceMapFile(original.source??''),line:original.line,column:original.column,function:scrub(name??frame.function)},artifactDigest:row.digest};
      } catch { return {generated:frame,status:'invalid_artifact',artifactDigest:row.digest} }
    })());}
    return results;
  };
}
