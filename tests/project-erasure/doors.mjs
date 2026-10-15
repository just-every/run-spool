import assert from 'node:assert/strict';
import {legacyMailRows} from '../legacy-mail.mjs';
import {canonical} from '../../src/domain/privacy.ts';

// Every archived row, the erasure receipts and the development outbox listing:
// what a refused erase must leave exactly as it was.
async function state(app){
 const {data}=await app.archive();
 const outbox=(await legacyMailRows(app.origin)).map(row=>row.id);
 return canonical({data,receipts:await app.json('/api/erasures'),outbox});
}
// Each refusal through public HTTP, before and after compared.
export async function refusals(app,{project,keys,planHash}){
 const before=await state(app),path=`/api/projects/${project}/erasure`,confirm={confirm:project,planHash},results=[];
 const check=async(label,response,expected)=>{assert.equal(response.status,expected,label);await response.body?.cancel();results.push({label,status:response.status});};
 // Anonymous: no owner cookie (the dev key alone is not a session).
 await check('anonymous preview',await fetch(app.origin+path,{headers:{'x-rer-dev-key':app.devKey}}),401);
 await check('anonymous erase',await fetch(app.origin+path,{method:'POST',headers:{Origin:app.origin,'x-rer-dev-key':app.devKey,'Content-Type':'application/json'},body:JSON.stringify(confirm)}),401);
 for(const [kind,key] of Object.entries(keys)){
  await check(`${kind} grant preview`,await app.request(path,'GET',undefined,{agent:key}),403);
  await check(`${kind} grant erase`,await app.request(path,'POST',confirm,{agent:key}),403);
 }
 await check('unknown project preview',await app.request('/api/projects/no-such-project/erasure'),404);
 await check('unknown project erase',await app.request('/api/projects/no-such-project/erasure','POST',{confirm:'no-such-project',planHash}),404);
 await check('wrong confirmation',await app.request(path,'POST',{confirm:project+'-wrong',planHash}),400);
 await check('missing confirmation',await app.request(path,'POST',{planHash}),400);
 await check('cross-origin erase',await app.request(path,'POST',confirm,{headers:{Origin:'https://attacker.example'}}),403);
 assert.equal(await state(app),before,'refused erase requests change nothing');
 return results;
}
// A completed erasure leaves nothing to erase: a repeat is refused and changes nothing.
export async function secondErase(app,{project,planHash}){
 const before=await state(app);
 const response=await app.request(`/api/projects/${project}/erasure`,'POST',{confirm:project,planHash});
 assert.equal(response.status,404,'a second erase finds no project');await response.body?.cancel();
 assert.equal(await state(app),before,'a second erase changes nothing');
 return {status:404};
}
