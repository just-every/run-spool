#!/usr/bin/env node
import { sourceMapCli } from './cli.mjs';
sourceMapCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify({uploaded:result.uploaded}))).catch(error=>{ console.error(error.message); process.exitCode=1 });
