import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {injectDebugId} from './inject.mjs';
import {uploadSourceMaps} from './upload.mjs';

/** esbuild's onEnd follows its normal write step. Keep output in memory until uploads succeed. */
export function spoolSourceMaps(options){
 return {name:'spool-source-maps',setup(build){
  const shouldWrite=build.initialOptions.write!==false;
  build.initialOptions.write=false;
  build.onEnd(async result=>{
   if(result.errors.length)return;
   const files=result.outputFiles??[],artifacts=[];
   for(const file of files){
    if(!/\.[cm]?js$/.test(file.path))continue;
    const map=files.find(row=>row.path===file.path+'.map');
    if(!map)throw new Error(`${file.path}: Spool requires external sourcemaps for every JavaScript output`);
    const artifact=injectDebugId(file.text,map.text);
    const name=relative(resolve(build.initialOptions.absWorkingDir??process.cwd(),build.initialOptions.outdir??dirname(build.initialOptions.outfile??file.path)),file.path)+'.map';
    artifacts.push({file:name,...artifact});
    for(const [output,text] of [[file,artifact.code],[map,JSON.stringify(artifact.map)]]){const contents=new TextEncoder().encode(text);output.contents=contents;Object.defineProperty(output,'text',{get:()=>text});output.hash=createHash('sha256').update(contents).digest('base64url');}
   }
   await uploadSourceMaps(options,artifacts);
   if(shouldWrite)for(const file of files){await mkdir(dirname(file.path),{recursive:true});await writeFile(file.path,file.contents);}
  });
 }};
}
