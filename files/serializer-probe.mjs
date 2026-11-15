// Author: Run Edit Run fleet (Codex), 2026-11-15 UTC.
// Run against an explicitly selected installed Seroval module. No app secrets.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const seroval=await import(pathToFileURL(process.argv[2]));
const rows=[];
async function check(name,fn){try{await fn();rows.push({name,pass:true});}catch(error){rows.push({name,pass:false,error:error.name});}}
const {serialize,deserialize,toJSON,fromJSON,fromCrossJSON,createStream,toJSONAsync}=seroval;
await check('legitimate typed-array, RegExp, sparse array, cyclic object and Map round trip',()=>{
 const value={bytes:new Uint16Array([7,1024]),regexp:/spool/gi,array:[1,,3],map:new Map([['key','value']])};value.self=value;
 for(const out of [deserialize(serialize(value)),fromJSON(toJSON(value))]){
  assert.deepEqual([...out.bytes],[7,1024]);assert.equal(out.regexp.source,'spool');assert.equal(out.regexp.flags,'gi');
  assert.equal(out.array.length,3);assert.equal(1 in out.array,false);assert.equal(out.map.get('key'),'value');assert.equal(out.self,out);
 }
});
await check('legitimate completed stream retains buffered events',async()=>{
 const stream=createStream();stream.next('first');stream.return('done');
 const output=fromJSON(await toJSONAsync(stream)),received=[];
 output.on({next:value=>received.push(['next',value]),return:value=>received.push(['return',value]),throw:value=>received.push(['throw',value])});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(received,[['next','first'],['return','done']]);
});
await check('typed-array constructor name is derived from intrinsic brand',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(Uint8Array,'name');
 try{Object.defineProperty(Uint8Array,'name',{value:'InjectedConstructor',configurable:true});
  const source=serialize(new Uint8Array([9,2]));assert.equal(source.includes('InjectedConstructor'),false);
  assert.deepEqual([...deserialize(source)],[9,2]);
 }finally{Object.defineProperty(Uint8Array,'name',descriptor);}
});
await check('RegExp script delimiters and HTML comment syntax remain encoded',()=>{
 for(const source of ['</script><script>synthetic</script>','<!--','<script','<\u2028']){
  const re=new RegExp(source,'g'),compiled=serialize(re);assert.equal(compiled.includes('<'),false);
  const output=deserialize(compiled);assert.equal(output.source,re.source);assert.equal(output.flags,'g');
 }
});
await check('array-shaped JSON objects are refused before length iteration',()=>{
 for(const length of [3,1.5,-1])assert.throws(()=>fromJSON({t:{t:9,i:0,a:{length}},f:127,m:[]}));
});
await check('out-of-range and fractional sequence termination indexes are refused',()=>{
 for(const doneAt of [2,1.5,-2])assert.throws(()=>fromJSON({t:{t:35,i:0,a:[{t:0,s:1}],s:-1,l:doneAt},f:127,m:[]}));
});
await check('forged stream object cannot invoke an attacker-selected on callable',()=>{
 let called=0;const source={on(){called++}};
 // A forged IndexedValue references a real object, but has no trusted stream brand.
 assert.throws(()=>fromCrossJSON({t:30,a:[{t:2,s:1},{t:4,i:0}]},{refs:new Map([[0,source]])}));
 assert.equal(called,0);
});
console.log(JSON.stringify({module:process.argv[2].includes('1.6.11')?'patched':'baseline',checks:rows,passed:rows.filter(x=>x.pass).length,total:rows.length},null,2));
if(process.argv.includes('--require-pass')&&rows.some(x=>!x.pass))process.exitCode=1;
