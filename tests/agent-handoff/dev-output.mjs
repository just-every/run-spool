import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';

// Keep each dev server's own output (rer, Vite, the Cloudflare plugin and workerd) under
// .artifacts/dev-server, which CI uploads when a job fails. The checkout's private settings
// (keys, secrets, tokens and alert destinations) and the dev key are replaced before the text leaves the temporary checkout.
let sequence=0;
export async function keepDevOutput(text,settingsFile,devKey){
 const settings=parseEnv(await readFile(settingsFile,'utf8').catch(()=>''));
 const secrets=[...Object.entries(settings).filter(([name])=>/KEY|SECRET|TOKEN|PASSWORD|DESTINATIONS/i.test(name)).map(([,value])=>value),devKey].filter(value=>typeof value==='string'&&value.length>=8).sort((a,b)=>b.length-a.length);
 let kept=text;for(const secret of secrets)kept=kept.replaceAll(secret,'[redacted]');
 const folder=resolve('.artifacts/dev-server');await mkdir(folder,{recursive:true});
 await writeFile(resolve(folder,`${process.pid}-${++sequence}.log`),kept);
}
