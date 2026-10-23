import {injectDebugId} from './inject.mjs';
import {uploadSourceMaps} from './upload.mjs';

/** Stamp before content hashing; upload final named assets before emit. */
export class SpoolSourceMapsPlugin {
 constructor(options){this.options=options;}
 apply(compiler){
  compiler.hooks.thisCompilation.tap('spool-source-maps',compilation=>{
   const scripts=()=>compilation.getAssets().filter(asset=>/\.[cm]?js$/.test(asset.name));
   const mapFor=asset=>{
    const map=compilation.getAsset(asset.name+'.map');
    if(!map)throw new Error(`${asset.name}: Spool requires devtool: 'source-map' for every JavaScript asset`);
    return map;
   };
   compilation.hooks.processAssets.tap({name:'spool-source-maps-stamp',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING+1},()=>{
    const {RawSource}=compiler.webpack.sources;
    for(const asset of scripts()){
     const map=mapFor(asset),artifact=injectDebugId(asset.source.source().toString(),map.source.source().toString());
     compilation.updateAsset(asset.name,new RawSource(artifact.code));
     compilation.updateAsset(map.name,new RawSource(JSON.stringify(artifact.map)));
    }
   });
   compilation.hooks.processAssets.tapPromise({name:'spool-source-maps-upload',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT},async()=>{
    const artifacts=[];
    for(const asset of scripts()){
     const code=asset.source.source().toString(),artifact=injectDebugId(code,mapFor(asset).source.source().toString());
     if(artifact.code!==code)throw new Error(`${asset.name}: JavaScript appeared after source-map stamping; place its emitting plugin before Spool`);
     artifacts.push({file:asset.name+'.map',...artifact});
    }
    await uploadSourceMaps(this.options,artifacts);
   });
  });
 }
}
export const spoolSourceMaps=options=>new SpoolSourceMapsPlugin(options);
