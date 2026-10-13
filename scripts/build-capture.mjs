import {build} from 'esbuild';
import {constants} from 'node:fs';
import {open, writeFile} from 'node:fs/promises';

const outfile = 'public/errors-capture.js';
const result = await build({entryPoints:['src/domain/capture.ts'],outfile,bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',write:false});
const output = Buffer.from(result.outputFiles[0].contents);
let existing;
try {
  const file = await open(outfile, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    existing = await file.readFile();
  } finally {
    await file.close();
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!existing?.equals(output)) {
  await writeFile(outfile, output, {flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW});
}
