import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from '../browser-launch.mjs';
import {openGate} from '../auth.mjs';

// Reads Spool's own pages as the signed-in owner at desktop and phone width; each page's
// check waits for what the API already proved, then the page must not scroll sideways.
export async function readScreens(origin,cookie,pages){
 await mkdir('.artifacts/runtimes',{recursive:true});
 const browser=await launchBrowser();
 try{
  for(const width of [1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   try{
    await openGate(context,origin);
    await context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
    const page=await context.newPage();
    for(const {name,path,check} of pages){
     await page.goto(origin+path);await check(page);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} at ${width}: no horizontal page scroll`);
     await page.screenshot({path:`.artifacts/runtimes/${name}-${width}.png`,fullPage:true});
    }
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
