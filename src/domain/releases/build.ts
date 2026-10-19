/** This internal identity is outside the SDK dist alphabet. SDK input never
 * passes through storedBuild, so an explicit string cannot denote absence. */
export const absentDist = '[sentry:no-dist]';
const distPattern=/^[a-zA-Z0-9._:-]{1,100}$/;
export function sentryDistBuild(value:unknown):string {
 if(value===undefined||value===null)return absentDist;
 return sentryDistBuildRequired(value);
}
/** Owner/deploy registration and archives address the internal build identity. */
export function storedBuild(value:unknown):string {
 if(value===absentDist)return absentDist;
 return sentryDistBuildRequired(value);
}
function sentryDistBuildRequired(value:unknown):string {
 if(typeof value!=='string'||!distPattern.test(value))throw new Error('Invalid build');
 return value;
}
