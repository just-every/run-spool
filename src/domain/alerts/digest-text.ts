import { scrub } from '../privacy';

// Archive validation uses the same text rules without loading live dispatchers.
export const scrubDigest=(value:string)=>value.split('\n').map(line=>scrub(line)).join('\n');
