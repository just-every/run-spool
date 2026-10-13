import { readFile, writeFile } from 'node:fs/promises';
import { injectDebugId } from './inject.mjs';
import { uploadSourceMaps } from './upload.mjs';
export async function sourceMapCli(args) {
  const options = {}, files = [];
  const names = new Map([['--endpoint','endpoint'],['--project','project'],['--release','release'],['--build','build'],['--key-env','keyEnv']]);
  for (let index=0; index<args.length; index++) {
    const arg=args[index];
    if (names.has(arg)) { const name=names.get(arg); if(options[name] || !args[index+1] || args[index+1].startsWith('--')) throw new Error('Invalid or duplicate option'); options[name]=args[++index] }
    else if (arg.startsWith('--')) throw new Error('Unknown option');
    else files.push(arg);
  }
  if (!files.length) throw new Error('Usage: spool-sourcemaps --endpoint ORIGIN --project ID --release NAME --build DIST --key-env ENV_NAME bundle.js [bundle.js ...]');
  const artifacts=[];
  for (const file of files) {
    if (!/\.(?:c?js|mjs)$/.test(file)) throw new Error('Expected JavaScript bundle with adjacent .map');
    artifacts.push({ file, ...injectDebugId(await readFile(file,'utf8'),await readFile(`${file}.map`,'utf8')) });
  }
  const result=await uploadSourceMaps(options,artifacts);
  // Final output bytes and uploaded map agree. A failed upload leaves files untouched.
  for (const artifact of artifacts) { await writeFile(artifact.file,artifact.code); await writeFile(`${artifact.file}.map`,JSON.stringify(artifact.map)) }
  return result;
}
