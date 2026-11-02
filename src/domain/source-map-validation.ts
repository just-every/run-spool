import { AnyMap, decodedMappings } from '@jridgewell/trace-mapping';

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
