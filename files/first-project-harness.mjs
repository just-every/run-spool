import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {gate} from '../tests/auth.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
import {firstProjectJourney} from '../tests/setup-journey.mjs';
const origin='http://127.0.0.1:15583';
const dev=spawn(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','dev','--foreground','--port','15583'],{stdio:['ignore','pipe','pipe']});
// Dev output contains private owner entry URLs; consume without recording it.
let output='';dev.stdout.on('data',data=>output+=data);dev.stderr.on('data',data=>output+=data);
const diagnostic=()=>output.split('\n').filter(line=>/error|failed|usage|requires|refus|busy|Unknown/i.test(line)&&!line.includes('http')&&!/secret|key|token|owner|RER_OPEN|RER_SIGNED_IN/i.test(line)).slice(-8).join('\n');
const closed=new Promise(resolve=>dev.once('exit',(code,signal)=>resolve({code,signal})));
let browser;
try{
 let ready=false;for(let n=0;n<600;n++){if(dev.exitCode!==null)throw new Error('dev exited before readiness code='+dev.exitCode+' '+diagnostic());ready=await fetch(origin+'/health').then(r=>r.ok,()=>false);if(ready)break;await new Promise(r=>setTimeout(r,200));}if(!ready)throw new Error('dev health timeout');
 gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile('.rer/local/dev-key.env','utf8'))[1];
 browser=await launchBrowser();await firstProjectJourney(browser,origin,1440);console.log('firstProjectJourney on actual rer dev passed (1440 assertions, 1440/390 captures).');
}finally{await browser?.close();dev.kill('SIGINT');await closed;}
