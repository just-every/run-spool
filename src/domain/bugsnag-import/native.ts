import { buildId, machoUuid } from '../native-symbols/debug-formats';
export const nativeStackReason='Spool stores uploaded dSYM and NDK files by Mach-O UUID or ELF build id but does not yet read Mach-O/DWARF or ELF symbols, and its event frames keep no instruction address or module. Spool does not symbolicate these frames: they stay in private Bugsnag source custody and no original frame is claimed.';
const text=(value:any)=>typeof value==='string'?value:undefined;
/** Native frames: an address or binary identity with no source line, so only a debug file could name them. */
export function nativeFrames(data:any){
 const found={frames:0,machoUuids:new Set<string>(),buildIds:new Set<string>()};
 const stacks=[...(data.exceptions??[]).map((e:any)=>e?.stacktrace),...(data.threads??[]).map((t:any)=>t?.stacktrace)];
 for(const stack of stacks)for(const f of Array.isArray(stack)?stack:[]){
  if(!f||f.line_number!==undefined||f.lineNumber!==undefined)continue;
  const uuid=machoUuid(f.macho_uuid),id=buildId(text(f.build_id)??text(f.buildId));
  if(!uuid&&!id&&f.frame_address===undefined&&f.frameAddress===undefined)continue;
  found.frames++;if(uuid)found.machoUuids.add(uuid);if(id)found.buildIds.add(id);
 }
 return found;
}
