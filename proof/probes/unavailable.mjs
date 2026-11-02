import {launch,openContext,signedPage,origin,save,out} from './lib.mjs';
const label=process.argv[2],log=process.argv[3];
const b=await launch();const c=await openContext(b,log);const p=await signedPage(c,'/projects/'+process.argv[4]+'/issues');
await p.waitForTimeout(1500);
const r={url:new URL(p.url()).pathname,h1:await p.locator('h1').first().innerText(),text:(await p.locator('#content').innerText()).slice(0,200),switcher:await p.locator('.project-picker select option').allInnerTexts()};
await p.screenshot({path:`${out(label)}/sp18-1440-4-erased-url-after-reload.png`});save(label,'sp18-erased-url.json',r);console.log(JSON.stringify(r));await b.close();
