// Saving never holds up the page's own controls; leaving mid-write never drops the edit.
import {launch,openContext,signedPage,api,save,sizes,out,sleep} from './lib.mjs';
const label=process.argv[2],log=process.argv[3];
const b=await launch();const result={};const P='/api/projects/cedar-market';
for(const size of sizes){
 const r=result[size.name]={};
 const c=await openContext(b,log,{width:size.width,height:size.height});
 const page=await signedPage(c,'/projects/cedar-market/settings');
 await page.getByRole('heading',{name:'Inbound filters and usage',exact:true}).waitFor();
 const sec=name=>page.locator('section').filter({has:page.getByRole('heading',{name,exact:true})}).first();
 const rel=sec('Sentry release identity'),pat=rel.getByLabel('Automatic release name pattern');
 const original=(await api(c,P+'/release-policy')).body.policy.pattern;
 // 1. While the save is in flight (held 4 s), the page's controls are enabled and act at once; focus stays in the field.
 let release;const gate=new Promise(res=>{release=res});
 await page.route('**'+P+'/release-policy',async route=>{if(route.request().method()==='PUT'){await gate}await route.continue()});
 await pat.scrollIntoViewIfNeeded();await pat.fill('inflight-*');await pat.blur();await sleep(300);
 await pat.focus();
 const preview=rel.getByRole('button',{name:'Preview release policy',exact:true});
 r.whileSaving={fieldFocused:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),previewEnabled:await preview.isEnabled(),switcherEnabled:await page.locator('.project-picker select').isEnabled(),navEnabled:!(await page.getByRole('link',{name:'Releases'}).first().isDisabled().catch(()=>false)),
  fieldEditableWhileSaving:await pat.isEditable()};
 const t0=Date.now();await preview.click();await rel.getByText(/resolved issues checked/).waitFor();r.whileSaving.previewRanInMs=Date.now()-t0;r.whileSaving.serverStillOld=(await api(c,P+'/release-policy')).body.policy.pattern===original;
 await page.screenshot({path:`${out(label)}/sp11-${size.name}-independence-1-saving.png`});
 release();await rel.locator('.save-mark[data-state="saved"]').waitFor();await page.unroute('**'+P+'/release-policy');
 r.savedPattern=(await api(c,P+'/release-policy')).body.policy.pattern;
 // 2. After a refused save the same controls still act and keep focus.
 await c.setOffline(true);await pat.fill('refused-*');await pat.blur();await rel.getByRole('alert').filter({hasText:'Not saved'}).waitFor();await pat.focus();
 r.afterRefusal={previewEnabled:await preview.isEnabled(),switcherEnabled:await page.locator('.project-picker select').isEnabled(),fieldFocused:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),fieldValueKept:await pat.inputValue()};
 await c.setOffline(false);await rel.getByRole('button',{name:'Retry',exact:true}).click();await rel.locator('.save-mark[data-state="saved"]').waitFor();
 // 3. Leaving mid-write: type, then go to Releases within the pause; the edit is sent on leaving.
 await pat.fill('left-midwrite-*');
 if(size.width<500)await page.getByRole('button',{name:/^Menu/}).click();
 await page.getByRole('link',{name:'Releases',exact:true}).first().click();
 await sleep(1500);r.leftInApp={path:new URL(page.url()).pathname,server:(await api(c,P+'/release-policy')).body.policy.pattern};
 // 4. Page hide: type, then leave the page entirely before the pause ends.
 await page.goto(new URL(page.url()).origin+'/projects/cedar-market/settings');await pat.waitFor();await pat.fill('hidden-midwrite-*');await page.goto('about:blank');await sleep(1500);
 r.pageHide={server:(await api(c,P+'/release-policy')).body.policy.pattern};
 const cur=(await api(c,P+'/release-policy')).body;await api(c,P+'/release-policy','PUT',{revision:cur.revision,policy:{...cur.policy,pattern:original}});
 await c.close();
}
save(label,'sp11-independence.json',result);console.log(JSON.stringify(result,null,1));
await b.close();
