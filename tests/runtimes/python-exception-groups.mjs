import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {objectJson} from '../../src/domain/sentry/wire.ts';
import {expectedOutcomes,issueDetails,outcomeMap,referenceCollector} from './harness.mjs';
import {readScreens} from './screens.mjs';

// [SDK-010] acceptance 4 (Python): each unmodified sentry-sdk program runs once against the reference
// collector and once against Spool with only the DSN changed; the tree the SDK described with
// mechanism.exception_id and parent_id must survive storage and appear once per member on screen.
const programs=[
 {project:'rt-python-related',script:'group.py',shape:'ExceptionGroup(TypeError,ValueError)'},
 {project:'rt-python-taskgroup',script:'task_group.py',shape:'ExceptionGroup(ExceptionGroup(KeyError,ValueError),TypeError)'},
];
const mechanismKeys=['type','handled','synthetic','source','is_exception_group','exception_id','parent_id'];
const pick=mechanism=>Object.fromEntries(mechanismKeys.filter(key=>mechanism?.[key]!==undefined).map(key=>[key,mechanism[key]]));
const frameIdentity=frame=>[frame.filename?.split(/[\\/]/).at(-1)??null,frame.function??null,frame.lineno??null,frame.in_app??null];
const sorted=nodes=>nodes.map(node=>({...node,children:sorted(node.children)})).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1);
// What the SDK itself sent, as a tree: each node is an exception with its own frames.
function sentTree(values){
 const node=exception=>({title:`${exception.type}: ${exception.value??''}`,frames:(exception.stacktrace?.frames??[]).map(frame=>[String(frame.lineno),frame.function]),
  children:values.filter(child=>child!==exception&&child.mechanism?.parent_id!==undefined&&child.mechanism.parent_id===exception.mechanism?.exception_id).map(node)});
 return sorted(values.filter(exception=>exception.mechanism?.parent_id===undefined).map(node));
}
const shape=nodes=>nodes.map(node=>node.title.split(':')[0]+(node.children.length?`(${shape(node.children)})`:'')).sort().join(',');
// What issue detail shows: every exception article, its own frames and the articles nested beneath it.
const renderedTree=async page=>sorted(await page.locator('.event-diagnostic').first().evaluate(root=>{
 const title=article=>{const heading=article.querySelector(':scope > h3').cloneNode(true);heading.querySelector('small')?.remove();return heading.textContent.trim()};
 const frames=article=>[...article.querySelectorAll(':scope > ol.exception-stack > li')].map(frame=>frame.querySelector(':scope > code, :scope > details > code')?.textContent.match(/:(\d+|\?)(?::\d+)? · (.*)$/)?.slice(1)??null);
 const node=article=>({title:title(article),frames:frames(article),children:[...article.querySelectorAll(':scope > .exception-children > article.exception')].map(node)});
 return [...root.querySelectorAll(':scope > article.exception')].map(node);
}));

export async function pythonExceptionGroups({app,origin,cookie,send}){
 const captured=[];
 for(const program of programs){
  const collector=await referenceCollector();
  try{const result=await send(program.script,collector.dsn);assert.equal(result.code,0,`${program.script}: ${result.stderr.slice(-500)}`)}finally{await collector.close()}
  const sentEvents=collector.sent.filter(item=>item.type==='event');
  assert.equal(sentEvents.length,1,`${program.script}: the SDK sends one error event`);
  const values=objectJson(sentEvents[0].bytes).exception.values,tree=sentTree(values);
  assert.equal(shape(tree),program.shape,`${program.script}: the SDK describes the program's exception tree`);
  const project=await app.json('/api/projects','POST',{id:program.project,name:program.project});
  const result=await send(program.script,project.dsn);assert.equal(result.code,0,`${program.script}: ${result.stderr.slice(-500)}`);
  const outcomes=await outcomeMap(app,project.id),expected=expectedOutcomes(collector.sent);
  assert.deepEqual([...outcomes].sort(),[...expected].sort(),`${program.script}: Spool outcomes reconcile with SDK-sent items`);
  const details=await issueDetails(app,project.id);
  assert.deepEqual(details.map(detail=>[detail.issue.count,detail.events.length]),[[1,1]],`${program.script}: the sent error is one persisted occurrence`);
  const [detail]=details,stored=detail.events[0].event.sentry.exceptions;
  assert.deepEqual(stored.map(exception=>[exception.type,exception.value,exception.module??null]),values.map(exception=>[exception.type,exception.value,exception.module??null]),`${program.script}: every member, in SDK order`);
  assert.deepEqual(stored.map(exception=>pick(exception.mechanism)),values.map(exception=>pick(exception.mechanism)),`${program.script}: group flags and parent and exception ids`);
  assert.deepEqual(stored.map(exception=>(exception.stacktrace?.frames??[]).map(frameIdentity)),values.map(exception=>(exception.stacktrace?.frames??[]).map(frameIdentity)),`${program.script}: each member keeps its own frames`);
  captured.push({...program,project,detail,values,tree});
 }
 const [related,taskGroup]=captured;
 assert.ok(taskGroup.values.filter(exception=>!exception.mechanism.is_exception_group).every(exception=>exception.stacktrace?.frames.some(frame=>frame.vars)),'each failed task sent its own frame and locals');
 // Privacy and exact-project refusals hold for group evidence: no locals in packets, no other project's grant, no anonymous read.
 const grants=await Promise.all(captured.map(capture=>app.json(`/api/projects/${capture.project.id}/keys`,'POST',{kind:'agent'})));
 for(const [index,capture] of captured.entries()){
  const root=`/api/projects/${capture.project.id}/issues/${capture.detail.issue.id}`,event=capture.detail.events[0];
  const own={Cookie:'',Authorization:'Bearer '+grants[index].key},other={Cookie:'',Authorization:'Bearer '+grants[1-index].key};
  const packet=await app.json(root+'/packet','GET',undefined,own);
  const exceptions=packet.events[0].event.sentry.exceptions;
  assert.deepEqual(exceptions.map(exception=>pick(exception.mechanism)),capture.values.map(exception=>pick(exception.mechanism)),'the packet keeps the whole group tree');
  for(const frame of exceptions.flatMap(exception=>exception.stacktrace?.frames??[]))for(const key of ['vars','pre_context','context_line','post_context'])assert.equal(frame[key],undefined,'packets do not acquire local or source scope');
  assert.equal((await app.request(root+'/packet','GET',undefined,other)).status,403,'another project grant is refused');
  assert.equal((await app.request(`${root}/events/${event.id}?occurrence=${event.occurrence}`,'GET',undefined,{Cookie:''})).status,401,'anonymous detail refused');
 }
 await readScreens(origin,cookie,captured.map(capture=>({name:`python-${capture.script.replace('.py','').replace('_','-')}`,path:`/projects/${capture.project.id}/issues/${capture.detail.issue.id}`,check:async page=>{
  const width=page.viewportSize().width;
  await page.getByRole('heading',{name:'Related Exceptions',exact:true}).waitFor();
  await page.locator('.event-diagnostic article.exception').nth(capture.values.length-1).waitFor();
  assert.deepEqual(await renderedTree(page),capture.tree,`${capture.script} at ${width}: every SDK-sent member appears once, with its own frames, beneath its parent`);
  assert.equal(await page.locator('.event-diagnostic article.exception').count(),capture.values.length,`${capture.script} at ${width}: no member is repeated`);
  assert.equal(await page.locator('.event-diagnostic article.exception h3 small').count(),0,`${capture.script} at ${width}: no group member is marked as the root cause`);
  const axe=await new AxeBuilder({page}).include('.event-diagnostic').analyze();
  assert.deepEqual(axe.violations.filter(violation=>['serious','critical'].includes(violation.impact)).map(violation=>violation.id),[],`${capture.script} at ${width}: no serious Axe finding`);
  if(capture!==taskGroup)return;
  // A keyboard reaches and opens the locals of the most deeply nested failed task.
  const target=page.locator('.event-diagnostic article.exception').filter({has:page.locator(':scope > h3',{hasText:'KeyError'})}).locator(':scope > ol.exception-stack details').filter({has:page.locator(':scope > summary',{hasText:'Local variables · sent by SDK'})});
  await page.getByRole('heading',{name:'Related Exceptions',exact:true}).click();
  let reached=false;
  for(let step=0;step<80&&!reached;step++){await page.keyboard.press('Tab');reached=await target.locator(':scope > summary').evaluate(summary=>document.activeElement===summary)}
  assert.ok(reached,`${capture.script} at ${width}: Tab reaches the nested task's locals`);
  await page.keyboard.press('Enter');
  assert.equal(await target.evaluate(details=>details.open),true,`${capture.script} at ${width}: Enter opens the nested task's locals`);
  await target.locator(':scope > details > summary',{hasText:'sku'}).waitFor();
 }})));
 console.log('PROBE SDK-010 acceptance 4 Python groups: unmodified ExceptionGroup and nested asyncio.TaskGroup programs, reference and Spool with only the DSN changed -> every member, group flag, parent and exception id and own frames persisted; each member shown once beneath its parent at 1440 and 390, Axe clean, nested locals reachable by keyboard; packets carry no locals, another project grant 403, anonymous 401');
}
