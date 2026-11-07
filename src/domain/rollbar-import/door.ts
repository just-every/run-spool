import type { ImportDoorSource } from '../../modules/import-kit/src/door/types.ts';
import type { ImportMapping } from '../../modules/import-kit/src/types.ts';
import { canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
import { parseRollbar } from './source.ts';
import { mappingVersion } from './identity.ts';
import { rollbarMapping } from './mapping.ts';
export function rollbarSource(project: string): ImportDoorSource {
 let mapping: ImportMapping | undefined;
 return {
  parse(value,index) {
   if(index!==0)throw new Error('One Rollbar project export required');
   const records=parseRollbar(value);
   if((records[0].payload as any).project!==project)throw new Error('Rollbar project differs from import namespace');
   mapping=rollbarMapping(records,'rollbar:'+sha256(canonicalJson(value)));
   return records;
  },
  mapping:{version:mappingVersion,map(record){if(!mapping)throw new Error('Rollbar bundle required');return mapping.map(record);}},
 };
}
