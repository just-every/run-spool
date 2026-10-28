import {scrubText} from '../scrub';
// Scrub text leaves, keeping server timestamps and counters as numbers. Running
// the text scrubber over serialized JSON would turn a timestamp into invalid JSON.
export function activityDetail(value:string):string {
 if(value.length>32768)throw new Error('Activity detail exceeds limit');
 return JSON.stringify(JSON.parse(value),(_key,leaf)=>typeof leaf==='string'?scrubText(leaf,4000):leaf);
}
