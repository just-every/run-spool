import assert from 'node:assert/strict';
/** A fixture person's explicit policy choice, not an application default. */
export async function chooseLocalAgentPolicy(origin,cookie,headers={}){
 const response=await fetch(origin+'/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json',...headers},body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'test-owner-choice',class:'*',do:'autonomous'}],spend:{none:true}}})});
 assert.equal(response.status,200,'the fixture owner chooses agent policy through the native person door');await response.body?.cancel();
}
