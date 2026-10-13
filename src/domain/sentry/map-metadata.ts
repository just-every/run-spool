import { identity } from '../privacy.ts';
/** Metadata is removed before the existing bounded flat-map validator runs. Ignore lists are debugger hints that
 * Vite and Rollup add for bundled dependencies; mapping never reads them. */
export function sourceMapMetadata(map:unknown, explicitDebugId:unknown):{debugId:string;map:Record<string,unknown>}{
  if(!map||typeof map!=='object'||Array.isArray(map))throw new Error('Invalid source map');
  const input=map as Record<string,unknown>,debugId=identity(explicitDebugId??input.debug_id??input.debugId,'debugId');
  const metadata=[input.debug_id,input.debugId].filter(value=>value!==undefined);
  if(metadata.some(value=>typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)))throw new Error('Invalid source map debug metadata');
  if(metadata.some(value=>value!==debugId))throw new Error('Source map debug identity mismatch');
  const {debug_id:_snake,debugId:_camel,ignoreList:_ignore,x_google_ignoreList:_googleIgnore,...flat}=input;
  return {debugId,map:flat};
}
