import { sourceDiagnostics } from './path-mappings';
import { TraceMap, originalPositionFor, decodedMappings, traceSegment } from '@jridgewell/trace-mapping';
import { scrub, type Envelope } from './privacy';
import { sourceMapFile } from './source-map-path';
import { functionScopes, type FunctionScopes } from './source-map-functions';
export function validateMap(map:any): string {
  if (!map || map.version!==3 || !Array.isArray(map.sources) || !map.sources.length || map.sources.length>100 || map.sources.some((s:any)=>typeof s!=='string') || !Array.isArray(map.names) || map.names.length>10000 || map.names.some((s:any)=>typeof s!=='string') || typeof map.mappings!=='string' || 'sections' in map) throw new Error('Unsupported map (flat Source Map V3 only)');
  if (map.sourcesContent && (!Array.isArray(map.sourcesContent) || map.sourcesContent.some((s:any)=>s!==null&&typeof s!=='string'))) throw new Error('Invalid source content');
  if(map.mappings.length>131072 || map.mappings.split(';').length>10000 || map.mappings.split(',').length>20000 || (map.sourceRoot!==undefined && typeof map.sourceRoot!=='string') || Object.keys(map).some(k=>!['version','file','sourceRoot','sources','sourcesContent','names','mappings'].includes(k))) throw new Error('Map parser budget or field boundary');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for(const line of map.mappings.split(';')){
    if(!line)continue;
    for(const segment of line.split(',')){
      if(!segment)throw new Error('Empty map segment');
      let continuing=false,run=0,scalar=0,factor=1;
      for(const char of segment){const code=alphabet.indexOf(char);if(code<0)throw new Error('Invalid VLQ character');continuing=(code&32)!==0;run++;scalar+=(code&31)*factor;if(scalar>20000001||run>6)throw new Error('VLQ integer exceeds supported coordinate budget');if(!continuing){run=0;scalar=0;factor=1}else factor*=32;}
      if(continuing)throw new Error('Unterminated VLQ integer');
    }
  }
  const text = JSON.stringify(map); if(new TextEncoder().encode(text).length>262144) throw new Error('Map exceeds 256 KiB');
  const decoded=decodedMappings(new TraceMap(map));for(const line of decoded)for(const segment of line){if(![1,4,5].includes(segment.length)||segment.some(n=>!Number.isSafeInteger(n)||n<0||n>10000000)||(segment.length>=4 && (segment[1]!>=map.sources.length || segment[2]!>=10000000))||(segment.length===5 && segment[4]!>=map.names.length))throw new Error('Invalid decoded mapping');}return text;
}
export async function diagnose(db:D1Database, project:string, event:Envelope): Promise<any[]> {
  if (event.language) return sourceDiagnostics(db,project,event);
  const scopes = new Map<string, FunctionScopes>();
  return Promise.all(event.frames.map(async frame=>{
    if(!frame.debugId) return {generated:frame,status:'missing_debug_id'};
    const row = await db.prepare('SELECT payload,digest FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?').bind(project,event.release,event.build,frame.debugId).first<any>();
    if(!row) {
      const elsewhere = await db.prepare('SELECT 1 FROM artifacts WHERE project=? AND debug=?').bind(project,frame.debugId).first();
      return {generated:frame,status:elsewhere?'identity_mismatch':'missing_artifact'};
    }
    try {
      const map = JSON.parse(row.payload);
      const traced = new TraceMap(map), original = originalPositionFor(traced,{line:frame.line,column:frame.column!});
      if(original.line===null) return {generated:frame,status:'unmapped_position',artifactDigest:row.digest};
      const segment = traceSegment(traced,frame.line-1,frame.column!), sourceIndex = segment && segment.length >= 4 ? segment[1] : undefined;
      const source = sourceIndex === undefined ? null : map.sourcesContent?.[sourceIndex];
      let name: string | null = null;
      if (typeof source === 'string') {
        const key = `${row.digest}:${sourceIndex}`;
        if (!scopes.has(key)) scopes.set(key,functionScopes(source,sourceMapFile(original.source??'')));
        name = scopes.get(key)!(original.line,original.column!);
      }
      return {generated:frame,status:'mapped',original:{file:sourceMapFile(original.source??''),line:original.line,column:original.column,function:scrub(name??frame.function)},artifactDigest:row.digest};
    } catch { return {generated:frame,status:'invalid_artifact',artifactDigest:row.digest} }
  }));
}
