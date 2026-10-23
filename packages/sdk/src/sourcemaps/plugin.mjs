import { injectDebugId } from './inject.mjs';
import { uploadSourceMaps } from './upload.mjs';
/** Rollup/Vite build plugin. Output is not published if registration/upload fails. */
export function spoolSourceMaps(options) {
  return {
    name: 'spool-source-maps', apply: 'build', enforce: 'post',
    async generateBundle(_output, bundle) {
      const artifacts = [];
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        if (!chunk.map) throw new Error('Spool requires sourcemap:true for every emitted JavaScript chunk');
        const artifact = injectDebugId(chunk.code, JSON.parse(chunk.map.toString()));
        chunk.code = artifact.code;
        chunk.map = { ...artifact.map, toString: () => JSON.stringify(artifact.map), toUrl: () => `data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(artifact.map)).toString('base64')}` };
        // Rollup may already have materialized the map asset before this hook.
        const mapAsset = bundle[`${chunk.fileName}.map`];
        if (mapAsset?.type === 'asset') mapAsset.source = JSON.stringify(artifact.map);
        artifacts.push({file:chunk.fileName+'.map',...artifact});
      }
      const result = await uploadSourceMaps(options, artifacts);
      this.info(`Uploaded ${result.uploaded} source map${result.uploaded === 1 ? '' : 's'}.`);
    },
  };
}
