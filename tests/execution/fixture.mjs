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
  return {broken:before.map,fixed:after.map,type:error.name,message:error.message,frames:stack};
 }finally{await rm(directory,{recursive:true,force:true});}
}
