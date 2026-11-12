// Task-only HTTP client lifecycle: do not reuse sockets across fixture restarts.
// No retries, response substitution or assertion changes.
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json');
const undici=require(require.resolve('undici',{paths:[require.resolve('miniflare/package.json')]}));
undici.setGlobalDispatcher(new undici.Agent({pipelining:0}));
