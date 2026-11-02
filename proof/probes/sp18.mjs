import {launch,openContext,signedPage,api,origin,save,sizes,out,sleep} from './lib.mjs';
const label=process.argv[2]??'before',log=process.argv[3]??'demo-before.log';
const b=await launch();const result={};
for(const size of sizes){
 const c=await openContext(b,log,{width:size.width,height:size.height});
 const id=`erase-${label}-${size.name}-${Date.now()%100000}`;result["id"+size.name]=id;
 const first=await signedPage(c,'/projects/cedar-market/settings');const created=await api(c,'/api/projects','POST',{id,name:'Erase probe '+size.name});result.created=created.status;await first.close();
 const page=await signedPage(c,`/projects/${id}/settings`);
 await page.getByRole('heading',{name:'Erase this project',exact:true}).waitFor();
 await page.getByRole('button',{name:'Preview erasure',exact:true}).click();
 await page.getByText(/rows will be deleted\./).waitFor();
 await page.getByLabel(`Type ${id} to confirm`,{exact:true}).fill(id);
 await page.screenshot({path:`${out(label)}/sp18-${size.name}-1-preview.png`});
 await page.getByRole('button',{name:'Erase project',exact:true}).click();
 await page.getByRole('heading',{name:'Project erased',exact:true}).waitFor({timeout:120000});
 await sleep(2500);
 const r={};
 r.urlAfterErased=new URL(page.url()).pathname;
 r.receiptVisible=await page.getByRole('heading',{name:'Project erased',exact:true}).isVisible().catch(()=>false);
 r.switcherOptions=await page.locator('.project-picker select option').allInnerTexts();
 r.switcherValue=await page.locator('.project-picker select').inputValue().catch(()=>null);
 r.apiProjects=(await api(c,'/api/projects')).body.map(p=>p.id);
 r.heading=await page.locator('h1').first().innerText();
 await page.screenshot({path:`${out(label)}/sp18-${size.name}-2-after-erased.png`});
 // Move within the app without reloading: open Issues from the navigation.
 if(size.width<500)await page.getByRole('button',{name:/^Menu/}).click();
 await page.getByRole('link',{name:/^Issues/}).first().click();await sleep(1500);
 r.afterIssuesLink={url:new URL(page.url()).pathname,h1:await page.locator('h1').first().innerText()};
 await page.screenshot({path:`${out(label)}/sp18-${size.name}-3-issues-link.png`});
 result[size.name]=r;
 await c.close();
}
save(label,'sp18-probe.json',result);console.log(JSON.stringify(result,null,1));
await b.close();
