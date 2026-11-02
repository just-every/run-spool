import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire('/Users/zemaj/www/rer-consolidation/work/uip-spool-s3-settings/repo/package.json');
export const {chromium}=require('@playwright/test');
export const ROOT='/Users/zemaj/www/rer-consolidation/work/uip-spool-s3-settings';
export const origin=process.env.PROBE_ORIGIN??'http://127.0.0.1:4710';
export function gateKey(logName){
 const text=readFileSync(`${ROOT}/private/${logName}`,'utf8');
 const m=/RER_OPEN [^\n]*rer-dev=([A-Za-z0-9_-]+)/.exec(text);
 if(!m)throw new Error('no gate key in log');
 return m[1];
}
export async function launch(){return chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})}
export async function openContext(browser,logName,viewport={width:1440,height:900}){
 const context=await browser.newContext({viewport});
 const r=await context.request.post(origin+'/__dev/key',{data:{key:gateKey(logName)}});
 if(r.status()!==204)throw new Error('gate '+r.status());
 return context;
}
export async function signedPage(context,path){
 const page=await context.newPage();
 await page.goto(origin+path);
 if(new URL(page.url()).pathname==='/sign-in'){await page.getByRole('link',{name:'Continue as owner',exact:true}).click();await page.waitForURL(u=>new URL(u).pathname!=='/sign-in'&&!new URL(u).pathname.startsWith('/auth/'),{timeout:30000});}
 return page;
}
import {mkdirSync,writeFileSync} from 'node:fs';
export const sizes=[{name:'1440',width:1440,height:900},{name:'390',width:390,height:844}];
export function out(label){const dir=`${ROOT}/proof-stage/${label}`;mkdirSync(dir,{recursive:true});return dir}
export function save(label,name,value){writeFileSync(`${out(label)}/${name}`,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n')}
export async function api(context,path,method='GET',data){
 const r=await context.request.fetch(origin+path,{method,headers:{Origin:origin,...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{data:JSON.stringify(data)}:{})});
 let body=null;try{body=await r.json()}catch{}
 return {status:r.status(),body};
}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Quiet-hold probe: counts element additions and removals under #content, loading flashes, scroll and state kept.
export async function startWatch(page){
 await page.evaluate(()=>{
  const root=document.getElementById('content');
  const m=window.__watch={added:0,removed:0,flashes:0,samples:0,examples:[]};
  new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes)if(n.nodeType===1){m.added++;if(m.examples.length<8)m.examples.push('+'+n.tagName+'.'+(n.className||'')+':'+(n.textContent||'').slice(0,40))}for(const n of r.removedNodes)if(n.nodeType===1){m.removed++;if(m.examples.length<8)m.examples.push('-'+n.tagName+'.'+(n.className||'')+':'+(n.textContent||'').slice(0,40))}}}).observe(root,{childList:true,subtree:true});
  setInterval(()=>{m.samples++;if(/Loading (grouping|release|commit|project|organization|filters)|Refreshing/.test(root.innerText))m.flashes++},100);
 });
}
export async function readWatch(page){return page.evaluate(()=>window.__watch)}
