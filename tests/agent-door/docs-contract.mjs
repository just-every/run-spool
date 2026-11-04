import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
const method=(...parts)=>parts.join('/');

/** Read the published lists, independently of the catalogue that generates them. */
export function documentedInventory(html){
 const section=id=>{
  const start=html.indexOf(`<h2 id="${id}"`);assert.ok(start>=0,`Published inventory section ${id}`);
  const end=html.indexOf('<h2 ',start+4);return html.slice(start,end<0?undefined:end);
 };
 const names=html=>[...html.matchAll(/<li><code>([^<]+)<\/code>/g)].map(match=>match[1]).sort();
 const tools=names(section('offered-mcp-tools')),resources=section('resource-templates');
 assert.ok(tools.length>0,'The published tool inventory is populated');
 assert.equal(new Set(tools).size,tools.length,'Each offered tool is documented once');
 return {tools,resourceTemplates:names(resources),resourceText:resources};
}

export function documentedToolContracts(html){
 return [...html.matchAll(/<li><code>(spool\.[^<]+)<\/code> — scope <code>([^<]+)<\/code>; classes ([\s\S]*?)\.<\/li>/g)].map(([,name,scope,body])=>({name,scope,classes:[...body.split('.\n')[0].matchAll(/<code>([^<]+)<\/code>/g)].map(match=>match[1]).sort(),proofs:[...body.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([,href,journey])=>({href,journey}))})).sort((a,b)=>a.name.localeCompare(b.name));
}

/** Native emitted-Worker MCP and anonymous HTTP agree under independently adopted policies. */
export async function docsContract(app){
 execFileSync(process.execPath,['scripts/agent-door/docs.mjs','--check'],{stdio:'pipe'});
 for(const [name,policy] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
  await app.adopt(policy);
  const response=await fetch(app.origin+'/docs/agents');assert.equal(response.status,200);
  const html=await response.text();assert.ok(!html.includes('<script'),'The anonymous guide needs no session or script');
  const documented=documentedInventory(html);
  const offered=(await app.mcp(method('tools','list'))).tools;
  const tools=offered.map(tool=>tool.name).sort();
  const resources=(await app.mcp(method('resources','templates','list'))).resourceTemplates.map(resource=>resource.uriTemplate).sort();
  assert.deepEqual(documented.tools,tools,`${name}: complete documented and authenticated offered tool names agree`);
  const contracts=documentedToolContracts(html);
  assert.deepEqual(contracts.map(({proofs,...contract})=>contract),offered.map(tool=>({name:tool.name,scope:tool._meta['com.runeditrun/scope'],classes:[...tool._meta['com.runeditrun/classes']].sort()})),`${name}: every documented scope and possible class agrees with the authenticated tool`);
  for(const tool of contracts.filter(tool=>tool.classes.length>1))assert.ok(tool.proofs.length>0&&tool.proofs.every(proof=>proof.journey&&new URL(proof.href,app.origin).pathname.endsWith('.mjs')),`${tool.name}: conditional classes link to a named proof journey`);
  assert.deepEqual(documented.resourceTemplates,resources,`${name}: complete documented and authenticated resource templates agree`);
  const discovery=await app.mcp(method('server','discover'));
  const declaration=discovery._meta['com.runeditrun/capabilities'];
  const instructions=discovery.instructions;
  assert.deepEqual([...instructions.matchAll(/\bspool\.[a-z_]+\.[a-z_]+\b/g)].map(match=>match[0]).sort(),tools,`${name}: discovery instructions include exactly the offered registry tools`);
  assert.equal((await app.mcp('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'Synthetic documentation reader',version:'1'}})).instructions,instructions,'Initialization and discovery give the same specialist guidance');
  assert.ok(instructions.includes('/docs/agents')&&instructions.includes('triage engineer')&&instructions.includes('empty []'));
  const limits=discovery._meta['com.runeditrun/limits'];
  assert.equal(Number(/Requests per minute per agent: <code>(\d+)<\/code>/.exec(html)?.[1]),limits.requestsPerMinute,'Public request rate agrees with the native capacity');
  assert.equal(Number(/Maximum request body bytes: <code>(\d+)<\/code>/.exec(html)?.[1]),limits.maxBodyBytes,'Public body capacity agrees with the native door');
  for(const value of Object.values(limits))assert.ok(instructions.includes(String(value)),'Discovery includes each native capacity');
  assert.ok(declaration.refused.includes('resources'));
  assert.deepEqual(resources,[]);assert.match(documented.resourceText,/Unavailable/);assert.match(documented.resourceText,/<code>\[\]<\/code>/);
  assert.ok(!documented.tools.some(tool=>tool.startsWith('spool.workers.')||tool==='spool.events.list'),'Internal workers and undeclared event tools are absent');
  assert.deepEqual((await app.mcp(method('prompts','list'))).prompts,[],'Dormant specialist adapters gain no offered prompt');
  console.log(`PROBE BASE-AGENT-013 documentation parity (${name}): anonymous /docs/agents -> ${tools.length} exact authenticated tool names; unavailable resource templates []`);
 }
 await app.adopt(autonomousPolicy());
}
