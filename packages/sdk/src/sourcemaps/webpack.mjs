import {injectDebugId} from './inject.mjs';
import {uploadSourceMaps} from './upload.mjs';

/** Upload before webpack writes any output assets. A rejected upload rejects emit. */
export class SpoolSourceMapsPlugin {
 constructor(options){this.options=options;}
 apply(compiler){
  compiler.hooks.thisCompilation.tap('spool-source-maps',compilation=>{
  compilation.hooks.processAssets.tapPromise({name:'spool-source-maps',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING+1},async ()=>{
   const artifacts=[];
   for(const asset of compilation.getAssets()){
    if(!/\.[cm]?js$/.test(asset.name))continue;
    const map=compilation.getAsset(asset.name+'.map');
    if(!map)throw new Error(`${asset.name}: Spool requires devtool: 'source-map' for every JavaScript asset`);
    artifacts.push({file:asset.name+'.map',asset:asset.name,...injectDebugId(asset.source.source().toString(),map.source.source().toString())});
   }
   await uploadSourceMaps(this.options,artifacts);
   const {RawSource}=compiler.webpack.sources;
   for(const artifact of artifacts){compilation.updateAsset(artifact.asset,new RawSource(artifact.code));compilation.updateAsset(artifact.file,new RawSource(JSON.stringify(artifact.map)));}
  });
  });
 }
}
export const spoolSourceMaps=options=>new SpoolSourceMapsPlugin(options);
