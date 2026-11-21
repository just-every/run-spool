import {build} from 'esbuild';
import {constants} from 'node:fs';
import {open, writeFile} from 'node:fs/promises';

const outfile = 'public/errors-capture.js';
const result = await build({entryPoints:['src/domain/capture.ts'],outfile,bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',write:false});
const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW;
// Rewrite a generated file only when its bytes change.
async function emit(path, bytes) {
  const output = Buffer.from(bytes);
  let existing;
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      existing = await file.readFile();
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!existing?.equals(output)) await writeFile(path, output, {flag: flags});
}
await emit(outfile, result.outputFiles[0].contents);

// Ship the pinned official browser SDK locally; loader pages never fetch a CDN.
await build({stdin:{contents:"export * from '@sentry/browser';",resolveDir:process.cwd()},outfile:'public/spool-sentry-sdk.js',bundle:true,minify:true,format:'iife',globalName:'__SpoolSentrySDK',platform:'browser',target:'es2022'});

// The same stamp-and-upload tool as `spool-sourcemaps`, as one file the Source-map setup page serves, for people whose
// only Node is the installer's private one: `rer run --script spool-sourcemaps.mjs ...` runs it without npm.
const stamper = await build({entryPoints:['packages/sdk/src/sourcemaps/bin.mjs'],bundle:true,minify:true,format:'esm',platform:'node',target:'node22',write:false,
  banner:{js:"import{createRequire as __spoolRequire}from'node:module';const require=__spoolRequire(import.meta.url);"}});
await emit('public/spool-sourcemaps.mjs', stamper.outputFiles[0].contents);
