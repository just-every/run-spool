import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {resolve} from 'node:path';

// Exercise Base's real local admission layer around the emitted application.
// Production still uses the emitted entry; test hosts, like rer dev, add this layer.
export async function localRuntime(worker) {
 const entry=resolve('.artifacts/local-test-entry.mjs');
 await mkdir(resolve('.artifacts'),{recursive:true});
 await writeFile(entry,`import application from ${JSON.stringify(worker.modules[0].path)};
import {withDevIdentity} from ${JSON.stringify(resolve('src/modules/operator-auth/dev/index.mjs'))};
const local=withDevIdentity(application,{config:env=>({origin:env.AUTH_ORIGIN,OWNER_EMAIL:env.OWNER_EMAIL,SESSION_SECRET:env.SESSION_SECRET,SETUP_TOKEN:env.SETUP_TOKEN,local:env.AUTH_LOCAL==='true',branding:{productName:'Spool',signInPath:'/sign-in'}})});
export default {...application,fetch(request,env,ctx){const path=new URL(request.url).pathname;return path.startsWith('/__dev/')||path.startsWith('/auth/dev/')||path==='/auth/local/cli-session'?local.fetch(request,env,ctx):application.fetch(request,env,ctx)}};`);
 const bundled=await build({entryPoints:[entry],bundle:true,platform:'neutral',format:'esm',external:[worker.modules[0].path,'cloudflare:*','node:*'],write:false});
 return {...worker,modulesRoot:'/',modules:[{type:'ESModule',path:entry,contents:bundled.outputFiles[0].text},...worker.modules]};
}
