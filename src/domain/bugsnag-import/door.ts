import type { ImportDoorSource } from '../../modules/import-kit/src/door/types';
import type { ImportMapping, SourceBundle } from '../../modules/import-kit/src/types';
import { canonicalJson, sha256 } from '../../modules/import-kit/src/provenance/identity';
import { parseBugsnagOrganization, mappingVersion } from './source';
import { bugsnagMapping } from './mapping';
export function bugsnagImport(organization?:string):ImportDoorSource {
 let mapping:ImportMapping|undefined;
 return {parse(value,index){
  if(index!==0)throw new Error('One Bugsnag organization bundle required');
  const records=parseBugsnagOrganization(value);
  if(organization!==undefined&&(records[0].payload as any).organization.id!==organization)throw new Error('Bugsnag organization differs from import namespace');
  mapping=bugsnagMapping({records} as SourceBundle,'bugsnag:'+sha256(canonicalJson(value)));
  return records;
 },mapping:{version:mappingVersion,map(record){if(!mapping)throw new Error('Bugsnag bundle required');return mapping.map(record)}}};
}
