import {build} from 'esbuild';
import {mkdtemp,mkdir,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {frames} from '../../src/domain/capture.ts';
// The Harbor Shop cart module, built and minified with its map, in a broken
// release and a fixed one. Its real thrown stack is the captured event.
const format=`export const label = count => count + ' items';\n`;
const broken=`import { label } from './format.js';
export function lineCount(order) {
  return label(order.lines.length);
}
export function probe() {
  const environment = typeof process === 'undefined' ? 'no process object' : Object.keys(process.env).join(',') || 'empty environment';
  return fetch('https://example.com/').then(() => environment + '; network reached', error => environment + '; network blocked: ' + error.message);
}
export function spin() { for (;;) {} }
export function forgeMe() { return 'forge-me'; }
// Inside workerd only: rewrite the sandbox's report of forgeMe() into the captured failure.
if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
  const real = console.log;
  console.log = (line, ...rest) => {
    const marker = /^(SPOOL_OBSERVATION_[0-9a-f]{32}) .*forge-me/.exec(String(line));
    return marker ? real(marker[1] + ' ' + JSON.stringify({ phase: 'threw', name: 'TypeError', message: "Cannot read properties of undefined (reading 'length')", stack: 'TypeError: forged\\n    at lineCount (src/cart.js:3:27)' })) : real(line, ...rest);
  };
}
`;
const fixed=broken.replace('return label(order.lines.length);','return label(order.lines?.length ?? 0);');
async function bundle(directory,source){
 await mkdir(join(directory,'src'),{recursive:true});
 await mkdir(join(directory,'dist'),{recursive:true});await writeFile(join(directory,'src/cart.js'),source);await writeFile(join(directory,'src/format.js'),format);
 const built=await build({entryPoints:[join(directory,'src/cart.js')],outdir:join(directory,'dist'),bundle:true,minify:true,format:'esm',sourcemap:'external',write:false,absWorkingDir:directory,platform:'neutral'});
 const code=built.outputFiles.find(file=>file.path.endsWith('.js')).text,map=JSON.parse(built.outputFiles.find(file=>file.path.endsWith('.map')).text);
 await writeFile(join(directory,'dist/cart.js'),code);
 return {code,map,url:pathToFileURL(join(directory,'dist/cart.js')).href};
}
export async function shopFixture(){
 const directory=await realpath(await mkdtemp(join(tmpdir(),'spool-shop-')));
 try{
  const before=await bundle(join(directory,'broken'),broken),after=await bundle(join(directory,'fixed'),fixed);
  let error;try{(await import(before.url)).lineCount({});}catch(thrown){error=thrown;}
  // Spool's own stack parser, with the bundle served from the shop's origin.
  const stack=frames(error.stack.split(before.url).join('https://shop.example/assets/cart.js'),'cart-map').filter(frame=>frame.file==='https://shop.example/assets/cart.js');
  // Valid maps can carry modules that fail to load in another release. Keep
  // the captured entry and mappings intact while breaking its dependency.
  const dependency=before.map.sources.findIndex(source=>source.endsWith('/format.js'));
  if(dependency<0)throw new Error('The captured fixture must carry its format module');
  const loadFailures=Object.fromEntries([
   ['syntax','export const label = ;\n'],
   ['unresolved',"export { label } from './missing-format.js';\n"],
  ].map(([name,source])=>{
   const map=structuredClone(before.map);map.sourcesContent[dependency]=source;
   return [name,map];
  }));
  return {broken:before.map,fixed:after.map,loadFailures,type:error.name,message:error.message,frames:stack};
 }finally{await rm(directory,{recursive:true,force:true});}
}
