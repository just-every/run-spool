import { scrub } from '../scrub.ts';
/** Sentry release names are optional; native v1 keeps its registered identity contract. */
export function sentryRelease(value:unknown):{name:string;note?:string}{
 if(value===undefined||value===null)return {name:''};
 if(typeof value!=='string'||scrub(value)!==value||!value||value.length>200||['.','..','latest'].includes(value)||/[\n\t\r/\\]/.test(value)||/[\u0000-\u001f\u007f]/.test(value))return {name:'',note:'invalid_release_name'};
 return {name:value};
}
/** Existing native archives retain their original bounded names, including
 * names now rejected by Sentry intake. New SDK wire names are processed above. */
export function releaseIdentity(value:unknown):string{
 if(typeof value==='string'&&scrub(value)===value&&(/^[a-zA-Z0-9._:@+-]{1,200}$/.test(value)||sentryRelease(value).name===value&&!!value))return value;
 throw new Error('Invalid release');
}
export function releaseVersionKey(name:string):string|null{
 const version=name.slice(name.lastIndexOf('@')+1),m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(version);
 if(!m||m[4]?.split('.').some(v=>/^0\d+$/.test(v)||!v)||m[5]?.split('.').some(v=>!v))return null;
 const numeric=(v:string)=>String(v.length).padStart(3,'0')+':'+v;
 // Numeric prerelease components sort before text; an absent prerelease sorts last.
 // Hex text and low delimiters preserve identifier-prefix and list-prefix order.
 const pre=m[4]?m[4].split('.').map(v=>(/^\d+$/.test(v)?'0'+numeric(v):'1'+Array.from(v,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(''))+'!').join('')+'#':'~';
 return [numeric(m[1]),numeric(m[2]),numeric(m[3]),pre].join('|');
}
