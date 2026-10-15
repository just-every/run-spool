import { createHash } from 'node:crypto';
import { bundlePosition, insertRegistration } from './position.mjs';
const debugPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Standard Sentry debug registration, consumed by the unmodified SDK. */
export function injectDebugId(code, inputMap) {
  const map = typeof inputMap === 'string' ? JSON.parse(inputMap) : structuredClone(inputMap);
  if (!map || map.version !== 3 || !Array.isArray(map.sources) || !Array.isArray(map.names) || typeof map.mappings !== 'string' || map.sections) throw new Error('Flat Source Map V3 required');
  const declared = map.debug_id ?? map.debugId;
  if (declared !== undefined && (typeof declared !== 'string' || !debugPattern.test(declared))) throw new Error('Invalid source map debug ID');
  if (map.debug_id && map.debugId && map.debug_id !== map.debugId) throw new Error('Conflicting source map debug IDs');
  const position = bundlePosition(code), { registrations } = position;
  if (registrations.length) {
    if (registrations.length !== 1 || !declared || registrations[0] !== declared || !code.includes('_sentryDebugIds')) throw new Error('Bundle and map debug IDs must agree');
    delete map.debugId; map.debug_id = declared;
    return { code, map, debugId: declared };
  }
  if (declared) throw new Error('Map already has a debug ID but bundle has no matching registration');
  const hex = createHash('sha256').update(code).update('\0').update(JSON.stringify(map)).digest('hex');
  const debugId = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
  // A block-local initializer has an empty completion, preserving directive-only eval results.
  // debugId is built from hex digits and hyphens only, so it is quoted as is.
  const registration = `;{const _spoolDebugRegistration=(()=>{try{const g=globalThis,s=(new Error()).stack;if(s){g._sentryDebugIds=g._sentryDebugIds||{};g._sentryDebugIds[s]="${debugId}";g._sentryDebugIdIdentifier="sentry-dbid-${debugId}"}}catch{}})();}`;
  code = insertRegistration(code, map, position, registration);
  map.debug_id = debugId;
  return { code: `${code}\n//# debugId=${debugId}\n`, map, debugId };
}
