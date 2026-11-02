import {launch,openContext,signedPage,api,origin,save,sizes,out,sleep} from './lib.mjs';
const label='before',log='demo-before.log';
const b=await launch();const result={};
const sectionByHeading=(page,name)=>page.locator('section').filter({has:page.getByRole('heading',{name,exact:true})}).first();
for(const size of sizes){
 const c=await openContext(b,log,{width:size.width,height:size.height});
 const page=await signedPage(c,'/projects/cedar-market/settings');
 await page.getByRole('heading',{name:'Inbound filters and usage',exact:true}).waitFor();
 const r={};
 r.saveAndRefreshButtons=(await page.getByRole('button').allInnerTexts()).filter(t=>/^(Save|Refresh|Unsaved)/.test(t));
 r.strings={
  proposals:await page.getByText(/inert grouping proposals/).first().innerText().catch(()=>null),
  native:(await sectionByHeading(page,'Sentry release identity').locator('p').first().innerText()),
  enableLines:await page.locator('.filter-policy .checkbox').allInnerTexts(),
 };
 for(const [name,file] of [['Project grouping rules','grouping'],['Sentry release identity','release'],['Commit author and message','commit'],['Inbound filters and usage','filters']]){
  const s=sectionByHeading(page,name);await s.scrollIntoViewIfNeeded();await s.screenshot({path:`${out(label)}/sp11-${size.name}-${file}.png`});
 }
 // Edit without pressing Save: nothing reaches the server.
 const rel=await api(c,'/api/projects/cedar-market/release-policy');
 await sectionByHeading(page,'Sentry release identity').getByLabel('Automatic release name pattern').fill(rel.body.policy.pattern+'x');
 await page.getByRole('heading',{name:'Commit author and message',exact:true}).scrollIntoViewIfNeeded();
 const share=await api(c,'/api/projects/cedar-market/commits/sharing');
 await sectionByHeading(page,'Commit author and message').getByRole('checkbox').click();
 await sleep(2500);
 r.editsWithoutSave={releasePatternAfter2s:(await api(c,'/api/projects/cedar-market/release-policy')).body.policy.pattern===rel.body.policy.pattern?'unchanged on server':'changed',commitShareAfter2s:(await api(c,'/api/projects/cedar-market/commits/sharing')).body.share===share.body.share?'unchanged on server':'changed'};
 r.saveButtonStatesAfterEdit={commit:await page.getByRole('button',{name:'Save commit sharing',exact:true}).isEnabled(),release:await page.getByRole('button',{name:'Save release policy',exact:true}).isEnabled()};
 result[size.name]=r;
 await c.close();
}
// Artifact cap: Save with no word.
{
 const c=await openContext(b,log,{width:1440,height:900});
 const page=await signedPage(c,'/projects/cedar-market/releases');
 const field=page.getByLabel('Artifact storage cap (bytes, optional)');await field.waitFor();
 await field.scrollIntoViewIfNeeded();
 const section=page.locator('section.source-map-setup');
 const beforeText=await section.innerText();
 await field.fill('987654321');await page.getByRole('button',{name:'Save artifact cap',exact:true}).click();await sleep(1500);
 const afterText=await section.innerText();
 result.artifactCap={newTextAfterSave:afterText.split('\n').filter(line=>!beforeText.includes(line)),saved:(await api(c,'/api/projects/cedar-market/artifact-storage')).body};
 await section.locator('h3',{hasText:'Artifact storage'}).first().scrollIntoViewIfNeeded();
 await page.screenshot({path:`${out(label)}/sp11-1440-artifact-cap.png`});
 // restore
 const cur=(await api(c,'/api/projects/cedar-market/artifact-storage')).body;
 await api(c,'/api/projects/cedar-market/artifact-storage','PUT',{revision:cur.revision,artifact_storage_cap:null});
 await c.close();
}
save(label,'sp11-probe.json',result);console.log(JSON.stringify(result,null,1));
await b.close();
