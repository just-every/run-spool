import {launch,openContext,signedPage,save,out} from './lib.mjs';
const label=process.argv[2],log=process.argv[3];
const b=await launch();const c=await openContext(b,log,{width:1440,height:900});
const dump={};
for(const path of ['settings','releases','capture','issues','alerts']){
 const p=await signedPage(c,`/projects/cedar-market/${path}`);await p.waitForTimeout(3500);
 if(path==='settings'){
  await p.getByRole('button',{name:'Preview erasure',exact:true}).click();await p.getByText(/rows will be deleted\./).waitFor();
  const s=p.locator('section[aria-labelledby="erasure-title"]');await s.scrollIntoViewIfNeeded();await s.screenshot({path:`${out(label)}/sp8-1440-erasure-preview.png`});
  const sec=await p.locator('section[aria-labelledby="erasure-title"]').innerText();dump['erasure-preview']=sec;
  // Business imports and audit appear as text on the page too.
 }
 dump[path]=await p.locator('#content').innerText();await p.close();
}
for(const [k,v] of Object.entries(dump))save(label,`text-${k}.txt`,v+'\n');
await b.close();console.log(Object.keys(dump).join(','),dump['erasure-preview'].slice(0,1500));
