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

/** Native emitted-Worker MCP and anonymous HTTP agree under independently adopted policies. */
export async function docsContract(app){
 execFileSync(process.execPath,['scripts/agent-door/docs.mjs','--check'],{stdio:'pipe'});
 for(const [name,policy] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
  await app.adopt(policy);
  const response=await fetch(app.origin+'/docs/agents');assert.equal(response.status,200);
  const html=await response.text();assert.ok(!html.includes('<script'),'The anonymous guide needs no session or script');
  const documented=documentedInventory(html);
  const tools=(await app.mcp(method('tools','list'))).tools.map(tool=>tool.name).sort();
  const resources=(await app.mcp(method('resources','templates','list'))).resourceTemplates.map(resource=>resource.uriTemplate).sort();
  assert.deepEqual(documented.tools,tools,`${name}: complete documented and authenticated offered tool names agree`);
  assert.deepEqual(documented.resourceTemplates,resources,`${name}: complete documented and authenticated resource templates agree`);
  const declaration=(await app.mcp(method('server','discover')))._meta['com.runeditrun/capabilities'];
  assert.ok(declaration.refused.includes('resources'));
  assert.deepEqual(resources,[]);assert.match(documented.resourceText,/Unavailable/);assert.match(documented.resourceText,/<code>\[\]<\/code>/);
  assert.ok(!documented.tools.some(tool=>tool.startsWith('spool.workers.')||tool==='spool.events.list'),'Internal workers and undeclared event tools are absent');
  assert.deepEqual((await app.mcp(method('prompts','list'))).prompts,[],'Dormant specialist adapters gain no offered prompt');
  console.log(`PROBE BASE-AGENT-013 documentation parity (${name}): anonymous /docs/agents -> ${tools.length} exact authenticated tool names; unavailable resource templates []`);
 }
 await app.adopt(autonomousPolicy());
}
