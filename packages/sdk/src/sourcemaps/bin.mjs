#!/usr/bin/env node
import { sourceMapCli } from './cli.mjs';

const args = process.argv.slice(2), json = args.includes('--json');
sourceMapCli(args.filter(arg => arg !== '--json')).then(result => {
  console.log(json ? JSON.stringify({ uploaded: result.uploaded }) : `Uploaded ${result.uploaded} source map${result.uploaded === 1 ? '' : 's'}.`);
}).catch(error => {
  console.error(`Source map upload failed: ${error.message}`);
  process.exitCode = 1;
});
