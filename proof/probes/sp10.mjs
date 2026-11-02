// 60 s quiet hold on Settings plus a change made from a second context.
import {launch,openContext,signedPage,api,origin,save,sizes,out,sleep,startWatch,readWatch} from './lib.mjs';
const label=process.argv[2],log=process.argv[3],HOLD=Number(process.argv[4]??60)*1000;
const b=await launch();const result={};
const sec=(page,name)=>page.locator('section').filter({has:page.getByRole('heading',{name,exact:true})}).first();
const probeState=async(page,size)=>page.evaluate(()=>({
 scrollY:Math.round(scrollY),
 fingerprint:document.querySelector('textarea[aria-label="Fingerprint rules"]')?.value??null,
 categoryOpen:[...document.querySelectorAll('details')].find(d=>/Filters by accepted category/.test(d.textContent))?.open??null,
 menuExpanded:document.querySelector('.menu-button')?.getAttribute('aria-expanded')??null,
 activeLabel:document.activeElement?.getAttribute('aria-label')??null,
}));
const shown=async(page)=>({
 releasePattern:await sec(page,'Sentry release identity').getByLabel('Automatic release name pattern').inputValue(),
 commitShared:await sec(page,'Commit author and message').getByRole('checkbox').isChecked(),
 localhostFilter:await page.locator('.filter-policy').filter({hasText:'Localhost and loopback'}).getByRole('checkbox').isChecked(),
 auditEntries:await page.locator('ol[aria-label="Audit entries"] > li').count(),
});
for(const size of sizes){
 const c=await openContext(b,log,{width:size.width,height:size.height});
 const page=await signedPage(c,'/projects/cedar-market/settings');
 await page.getByRole('heading',{name:'Inbound filters and usage',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Organization audit',exact:true}).waitFor();
 await sleep(2500);
 const requests=[];let t0=Date.now(),recording=false;
 page.on('request',r=>{const u=new URL(r.url());if(recording&&u.pathname.startsWith('/api/'))requests.push({t:Math.round((Date.now()-t0)/1000),method:r.method(),path:u.pathname});});
 // 1. an edit in progress (grouping fingerprint rules, not yet applied), an open disclosure, scrolled 900 px, the phone menu open.
 const fp=page.getByLabel('Fingerprint rules',{exact:true});await fp.scrollIntoViewIfNeeded();await fp.fill('error.type:ProbeError -> probe-edit');
 await page.evaluate(()=>[...document.querySelectorAll('details')].find(d=>/Filters by accepted category/.test(d.textContent)).open=true);
 if(size.width<500)await page.getByRole('button',{name:/^Menu/}).click();
 await page.evaluate(()=>scrollTo(0,900));await sleep(500);
 // The page's own opening reads write their audit rows, which the first background cycle then shows: let that cycle pass, then hold.
 await sleep(24000);
 const initial=await shown(page);
 const start=await probeState(page,size);
 t0=Date.now();recording=true;
 await startWatch(page);
 await page.screenshot({path:`${out(label)}/sp10-${size.name}-1-start.png`});
 // 2. Phase A: nothing changes anywhere. The page just sits for the hold.
 await sleep(HOLD);
 const end=await probeState(page,size),watch=await readWatch(page);
 await page.screenshot({path:`${out(label)}/sp10-${size.name}-2-end.png`});
 const counts={};for(const r of requests)counts[`${r.method} ${r.path}`]=(counts[`${r.method} ${r.path}`]??0)+1;
 const holdRequests=[...requests];
 // 3. Phase B: a second context changes things through the API; the open sections show it without a click.
 await startWatch(page);
 const c2=await openContext(b,log,{width:1280,height:800});await signedPage(c2,'/projects/cedar-market/settings').then(p=>p.close());
 const rp=(await api(c2,'/api/projects/cedar-market/release-policy')).body,cs=(await api(c2,'/api/projects/cedar-market/commits/sharing')).body,fl=(await api(c2,'/api/projects/cedar-market/inbound-filters')).body;
 const newPattern=rp.policy.pattern+'-second';
 const writes={
  release:(await api(c2,'/api/projects/cedar-market/release-policy','PUT',{revision:rp.revision,policy:{...rp.policy,pattern:newPattern}})).status,
  commit:(await api(c2,'/api/projects/cedar-market/commits/sharing','PUT',{revision:cs.revision,share:!cs.share})).status,
  filter:(await api(c2,'/api/projects/cedar-market/inbound-filters','PUT',{revision:fl.revision,policy:{...fl.policy,filters:{...fl.policy.filters,localhost:{enabled:!fl.policy.filters.localhost.enabled}}}})).status,
 };
 const wroteAt=Date.now();let final=await shown(page),seenAfter=null;
 while(Date.now()-wroteAt<30000){final=await shown(page);if(final.releasePattern===newPattern&&final.commitShared===!cs.share&&final.localhostFilter===!fl.policy.filters.localhost.enabled){seenAfter=Math.round((Date.now()-wroteAt)/1000);break}await sleep(500)}
 const watchChange=await readWatch(page),endB=await probeState(page,size);
 await page.screenshot({path:`${out(label)}/sp10-${size.name}-3-after-second-context.png`});
 result[size.name]={start,end,endAfterChange:endB,initialShown:initial,finalShown:final,secondContextWrites:writes,secondContextSet:{releasePattern:newPattern,commitShared:!cs.share,localhostFilter:!fl.policy.filters.localhost.enabled},shownWithoutClickAfterSeconds:seenAfter,watchDuringHold:watch,watchAfterChange:watchChange,requestCountsDuringHold:counts,requestLog:holdRequests};
 // restore
 const rp2=(await api(c2,'/api/projects/cedar-market/release-policy')).body,cs2=(await api(c2,'/api/projects/cedar-market/commits/sharing')).body,fl2=(await api(c2,'/api/projects/cedar-market/inbound-filters')).body;
 await api(c2,'/api/projects/cedar-market/release-policy','PUT',{revision:rp2.revision,policy:{...rp2.policy,pattern:rp.policy.pattern}});
 await api(c2,'/api/projects/cedar-market/commits/sharing','PUT',{revision:cs2.revision,share:cs.share});
 await api(c2,'/api/projects/cedar-market/inbound-filters','PUT',{revision:fl2.revision,policy:fl.policy});
 await c2.close();await c.close();
}
save(label,'sp10-probe.json',result);
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,{start:v.start,end:v.end,endAfterChange:v.endAfterChange,watchDuringHold:v.watchDuringHold,watchAfterChange:v.watchAfterChange,finalShown:v.finalShown,set:v.secondContextSet,seen:v.shownWithoutClickAfterSeconds,counts:v.requestCountsDuringHold}])),null,1));
await b.close();
