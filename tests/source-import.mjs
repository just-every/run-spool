import {registerHooks} from 'node:module';
import {extname} from 'node:path';

const sourceRoot=new URL('../src/',import.meta.url).href;

// Node strips source types; resolve the extensionless TS imports used by Vite.
// Keep this consumer hook scoped to source loading and remove it afterwards.
export async function importSource(url){
 const hooks=registerHooks({resolve(specifier,context,nextResolve){
  const relative=specifier.startsWith('./')||specifier.startsWith('../');
  if(relative&&context.parentURL?.startsWith(sourceRoot)&&!extname(specifier))specifier+='.ts';
  return nextResolve(specifier,context);
 }});
 try{return await import(url.href)}finally{hooks.deregister()}
}
