import {pathToFileURL} from 'node:url';
import {readFile,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const load = path => import(pathToFileURL(process.cwd()+'/'+path));
const log=await open('/tmp/spool-first-project-dev.log','w');
const dev=spawn('npx',['-y','@runeditrun/rer','dev','--foreground','--port','15679'],{stdio:['ignore',log.fd,log.fd]});
let browser,exited=false;
dev.once('exit',()=>{exited=true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function descendants(pid){let children=[];try{children=(await readFile(`/proc/${pid}/task/${pid}/children`,'utf8')).trim().split(/\s+/).filter(Boolean).map(Number)}catch{};return [...(await Promise.all(children.map(descendants))).flat(),...children]}
try{
 let ready=false;
 for(let attempt=0;attempt<180&&!exited;attempt++){try{const response=await fetch('http://127.0.0.1:15679/health');ready=response.ok;await response.body?.cancel()}catch{}if(ready)break;await pause(1000)}
 if(!ready)throw new Error('Prepared rer dev did not become ready; see /tmp/spool-first-project-dev.log');
 const {gate}=await load('tests/auth.mjs');
 const {launchBrowser}=await load('tests/browser-launch.mjs');
 const {firstProjectJourney}=await load('tests/setup-journey.mjs');
 gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile('.rer/local/dev-key.env','utf8'))[1];
 browser=await launchBrowser();
 await firstProjectJourney(browser,'http://127.0.0.1:15679',1440);
 console.log('firstProjectJourney passed at 1440; changed setup screens also captured at 390.');
}finally{
 await browser?.close();
 const owned=await descendants(dev.pid);
 if(!exited)dev.kill('SIGINT');
 for(let attempt=0;attempt<20&&!exited;attempt++)await pause(500);
 for(const pid of owned)try{process.kill(pid,'SIGTERM')}catch{}
 await log.close();
}
