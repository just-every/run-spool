// SP11 proof: change, read back through the API, repeat offline, press Retry online, read back.
import {launch,openContext,signedPage,api,origin,save,sizes,out,sleep} from './lib.mjs';
const label=process.argv[2]??'after',log=process.argv[3]??'demo-after.log';
const b=await launch();const result={};
const P='/api/projects/cedar-market';
for(const size of sizes){
 const r=result[size.name]={};
 const c=await openContext(b,log,{width:size.width,height:size.height});
 const page=await signedPage(c,'/projects/cedar-market/settings');
 await page.getByRole('heading',{name:'Inbound filters and usage',exact:true}).waitFor();
 const sec=name=>page.locator('section').filter({has:page.getByRole('heading',{name,exact:true})}).first();
 const shot=async(section,name)=>{await section.scrollIntoViewIfNeeded();await page.screenshot({path:`${out(label)}/sp11-${size.name}-${name}.png`})};
 const savedMark=section=>section.locator('.save-mark[data-state="saved"]');
 const failure=section=>section.getByRole('alert').filter({hasText:'Not saved'});
 const originals={release:(await api(c,P+'/release-policy')).body,commit:(await api(c,P+'/commits/sharing')).body,filters:(await api(c,P+'/inbound-filters')).body,grouping:(await api(c,P+'/grouping-rules')).body,cap:(await api(c,P+'/artifact-storage')).body};
 const offline=async(on)=>{await c.setOffline(on)};
 // Opening Settings does not itself write anything.
 // ---- Commit sharing: a toggle saves on change; turning sharing on asks once under the checkbox.
 {
  const s=sec('Commit author and message');const box=s.getByRole('checkbox');await s.scrollIntoViewIfNeeded();
  const x=r.commitSharing={saveButtons:await s.getByRole('button',{name:/^Save/}).count()};
  await box.check();await s.getByRole('button',{name:'Share author and message',exact:true}).waitFor();await shot(s,'commit-1-confirm');
  x.confirmText=await s.locator('.save-confirm').innerText();
  await s.getByRole('button',{name:'Share author and message',exact:true}).click();await savedMark(s).waitFor();await shot(s,'commit-2-saved');
  x.afterOnline=(await api(c,P+'/commits/sharing')).body.share;x.echoLineGone=!(await s.innerText()).includes('are now shared');
  await offline(true);await box.uncheck();await failure(s).waitFor();await shot(s,'commit-3-offline-failed');
  x.offlineFailure=await failure(s).innerText();x.valueKeptInField=await box.isChecked();x.serverWhileOffline=null;
  await offline(false);x.serverAfterRefusal=(await api(c,P+'/commits/sharing')).body.share;
  await s.getByRole('button',{name:'Retry',exact:true}).click();await savedMark(s).waitFor();x.afterRetry=(await api(c,P+'/commits/sharing')).body.share;await shot(s,'commit-4-retry-saved');
 }
 // ---- Release policy: the pattern saves as you type; the ordering rule asks once.
 {
  const s=sec('Sentry release identity');const pat=s.getByLabel('Automatic release name pattern');await s.scrollIntoViewIfNeeded();
  const x=r.releasePolicy={saveButtons:await s.getByRole('button',{name:/^Save/}).count(),refreshButtons:await s.getByRole('button',{name:/^Refresh/}).count()};
  await pat.fill('cedar-*');await savedMark(s).waitFor();x.patternSavedWithoutBlur=(await api(c,P+'/release-policy')).body.policy.pattern;await shot(s,'release-1-saved');
  await offline(true);await pat.fill('offline-*');await pat.blur();await failure(s).waitFor();await shot(s,'release-2-offline-failed');
  x.offlineFailure=await failure(s).innerText();x.valueKeptInField=await pat.inputValue();x.serverAfterRefusal=(await api(c,P+'/release-policy')).body.policy.pattern;
  await offline(false);await s.getByRole('button',{name:'Retry',exact:true}).click();await savedMark(s).waitFor();x.afterRetry=(await api(c,P+'/release-policy')).body.policy.pattern;await shot(s,'release-3-retry-saved');
  await s.getByLabel('Release ordering rule').selectOption('semver');await s.locator('.save-confirm').waitFor();x.orderConfirm=await s.locator('.save-confirm').innerText();x.orderServerBeforeConfirm=(await api(c,P+'/release-policy')).body.policy.order;await shot(s,'release-4-order-confirm');
  await s.getByRole('button',{name:'Preview release policy',exact:true}).click();await s.getByText(/resolved issues checked/).waitFor();
  await s.getByRole('button',{name:'Apply release policy',exact:true}).click();await savedMark(s).waitFor();x.orderAfterApply=(await api(c,P+'/release-policy')).body.policy.order;
  // A re-read taken before the save landed never brings back the old value.
  let hold=true;const stalled=[];
  await page.route('**'+P+'/release-policy',async route=>{if(hold&&route.request().method()==='GET'){const response=await route.fetch();stalled.push(()=>route.fulfill({response}));return}await route.continue()});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await sleep(600);
  await pat.fill('fresh-*');await savedMark(s).waitFor();hold=false;stalled.forEach(f=>f());await sleep(1200);
  x.staleRead={stalledReads:stalled.length,fieldAfterStaleReadLanded:await pat.inputValue(),server:(await api(c,P+'/release-policy')).body.policy.pattern};
  await page.unroute('**'+P+'/release-policy');
 }
 // ---- Inbound filters: a toggle saves on change, a list on blur or a pause.
 {
  const s=sec('Inbound filters and usage');await s.scrollIntoViewIfNeeded();
  const x=r.inboundFilters={saveButtons:await s.getByRole('button',{name:/^(Save|Refresh)/}).count(),unsavedLine:(await s.innerText()).includes('Unsaved filter changes')};
  const fs=s.locator('.filter-policy').filter({hasText:'Localhost and loopback'}),box=fs.getByRole('checkbox');
  const before=originals.filters.policy.filters.localhost.enabled;
  await box.setChecked(!before);await savedMark(fs).waitFor();x.toggleAfter=(await api(c,P+'/inbound-filters')).body.policy.filters.localhost.enabled;await shot(s,'filters-1-saved');
  const list=s.locator('.filter-policy').filter({hasText:'Error message patterns'}).locator('textarea');
  await list.fill('probe one*\nprobe two*');await list.blur();await savedMark(s.locator('.filter-policy').filter({hasText:'Error message patterns'})).waitFor();x.listAfter=(await api(c,P+'/inbound-filters')).body.policy.filters.messages.values;
  await offline(true);await box.setChecked(before);await failure(fs).waitFor();await shot(s,'filters-2-offline-failed');
  x.offlineFailure=await failure(fs).innerText();x.valueKeptInField=await box.isChecked();x.serverAfterRefusal=(await api(c,P+'/inbound-filters')).body.policy.filters.localhost.enabled;
  await offline(false);await fs.getByRole('button',{name:'Retry',exact:true}).click();await savedMark(fs).waitFor();x.afterRetry=(await api(c,P+'/inbound-filters')).body.policy.filters.localhost.enabled;await shot(s,'filters-3-retry-saved');
 }
 // ---- Grouping rules: editing holds; Preview then Apply is the one-step confirm.
 {
  const s=sec('Project grouping rules');await s.scrollIntoViewIfNeeded();
  const x=r.groupingRules={saveButtons:await s.getByRole('button',{name:/^(Save|Refresh)/}).count()};
  const fp=s.getByLabel('Fingerprint rules',{exact:true});
  await fp.fill('error.type:ProbeError -> probe-group');await sleep(1500);x.serverAfterTypingPause=(await api(c,P+'/grouping-rules')).body.policy.fingerprint;
  await s.getByRole('button',{name:'Preview grouping rules',exact:true}).click();await s.getByRole('button',{name:'Apply grouping rules',exact:true}).waitFor();await sleep(800);await shot(s,'grouping-1-confirm');
  await offline(true);await s.getByRole('button',{name:'Apply grouping rules',exact:true}).click();await failure(s).waitFor();await shot(s,'grouping-2-offline-failed');
  x.offlineFailure=await failure(s).innerText();x.valueKeptInField=await fp.inputValue();x.serverAfterRefusal=(await api(c,P+'/grouping-rules')).body.policy.fingerprint;
  await offline(false);await s.getByRole('button',{name:'Retry',exact:true}).click();await savedMark(s).waitFor();x.afterRetry=(await api(c,P+'/grouping-rules')).body.policy.fingerprint;await shot(s,'grouping-3-retry-saved');
 }
 // ---- Artifact cap (Releases): it used to save without a word.
 {
  const rel=await signedPage(c,'/projects/cedar-market/releases');
  const field=rel.getByLabel('Artifact storage cap (bytes, optional)');await field.waitFor();
  const s=rel.locator('section.source-map-setup');await field.scrollIntoViewIfNeeded();
  const x=r.artifactCap={saveButtons:await s.getByRole('button',{name:/^Save/}).count()};
  await field.fill('1234567');await s.locator('.save-mark[data-state="saved"]').waitFor();x.afterPause=(await api(c,P+'/artifact-storage')).body.artifact_storage_cap;await rel.screenshot({path:`${out(label)}/sp11-${size.name}-cap-1-saved.png`});
  await offline(true);await field.fill('7654321');await field.blur();await s.getByRole('alert').filter({hasText:'Not saved'}).waitFor();await rel.screenshot({path:`${out(label)}/sp11-${size.name}-cap-2-offline-failed.png`});
  x.offlineFailure=await s.getByRole('alert').filter({hasText:'Not saved'}).innerText();x.valueKeptInField=await field.inputValue();x.serverAfterRefusal=(await api(c,P+'/artifact-storage')).body.artifact_storage_cap;
  await offline(false);await s.getByRole('button',{name:'Retry',exact:true}).click();await s.locator('.save-mark[data-state="saved"]').waitFor();x.afterRetry=(await api(c,P+'/artifact-storage')).body.artifact_storage_cap;await rel.screenshot({path:`${out(label)}/sp11-${size.name}-cap-3-retry-saved.png`});
  await rel.close();
 }
 // restore
 const put=async(path,body)=>{const cur=(await api(c,P+path)).body;return api(c,P+path,'PUT',{...body,revision:cur.revision})};
 await put('/release-policy',{policy:originals.release.policy});await put('/commits/sharing',{share:originals.commit.share});await put('/inbound-filters',{policy:originals.filters.policy});await put('/grouping-rules',{policy:originals.grouping.policy});await put('/artifact-storage',{artifact_storage_cap:originals.cap.artifact_storage_cap});
 await c.close();
}
save(label,'sp11-probe.json',result);console.log(JSON.stringify(result,null,1));
await b.close();
