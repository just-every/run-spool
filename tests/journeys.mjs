import {spawn} from 'node:child_process';

// Each entry is one complete public-door journey, with its supporting phases.
// Keep the same grouping for local verification and the shared-build CI matrix.
export const shards={
 'product-tools':['product-runtime','triage-journey','phone-smoke','sentry-cli-compat','tunnel-flow','setup-flow'],
 'qualification':['product-runtime-qualification','multilingual-qualification','old-archive-qualification'],
 'sdk':['sentry-http','sentry-sdk','sdk-package'],
 'delivery':['alerts-runtime','alerts-ui','alerts-egress','execution-journey'],
 'evidence':['agent-handoff'],
 'repair-recovery':['repair-recovery'],
 'sentry-import':['sentry-import'],
 'project-erasure':['project-erasure'],
 'identity-import':['owner-claim','owner-erasure'],
 'runtimes-a':['sdk-runtimes:electron,node,python,go,java,rust'],
 'runtimes-b':['sdk-runtimes:ruby,php,dotnet,elixir'],
};
const requested=process.argv.slice(2);
const selected=requested.length?requested:Object.keys(shards);
for(const name of selected)if(!shards[name])throw Error('Unknown journey shard: '+name);
for(const name of selected)for(const journey of shards[name]){
 const [file,selection]=journey.split(':'),args=[`tests/${file}.mjs`,...(selection?.split(',')??[])];
 const command=selection?.includes('electron')&&process.platform==='linux'?'xvfb-run':process.execPath;
 const started=Date.now();console.log(`JOURNEY_START ${name}/${journey}`);
 const code=await new Promise((resolve,reject)=>{const child=spawn(command,command==='xvfb-run'?['-a',process.execPath,...args]:args,{stdio:'inherit',env:process.env});child.once('error',reject);child.once('exit',resolve)});
 console.log(`JOURNEY_END ${name}/${journey} exit=${code} seconds=${((Date.now()-started)/1000).toFixed(1)}`);
 if(code!==0)process.exit(code??1);
}
