import assert from 'node:assert/strict';
import {autonomousPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Legacy native-grant journeys explicitly choose their test company's policy.
 * This is the ordinary person policy door, never a product default or bypass. */
export async function chooseFixturePolicy(origin,cookie,headers={}) {
 const current=await fetch(origin+'/agents/api/state',{headers:{Origin:origin,Cookie:cookie,...headers}});
 assert.equal(current.status,200,'the native owner can read current test-company policy');
 const state=await current.json();
 if(!state.paired&&state.policy.complete)return;
 const response=await fetch(origin+'/agents/api/policy',{method:'PUT',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json',...headers},body:JSON.stringify({document:autonomousPolicy()})});
 if(response.status===409){const body=await response.json();assert.equal(body.code,'policy_managed_by_business');return;}
 assert.equal(response.status,200,'the native test owner chooses an answered company policy');await response.body?.cancel();
}
