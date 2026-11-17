// Author: Run Edit Run fleet, 2026-11-17. Public CLI status-door regression.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
const cli=resolve(process.argv[2], 'src/modules/portability/cli.mjs');
const directory=await mkdtemp(join(tmpdir(),'synthetic-spool-cookie-'));
const session=join(directory,'session');
const received=[];
const server=createServer((req,res)=>{received.push({url:req.url,cookie:req.headers.cookie});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({phase:'complete'}));});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
async function status(cookie) {
 await writeFile(session,cookie,{mode:0o600});
 const child=spawn(process.execPath,[cli,'status','--origin',origin,'--session-file',session,'--resume','synthetic-spool-1'],{stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
 const [code]=await once(child,'close');return {code,stdout,stderr};
}
try {
 const allowed=[];
 for(let code=0x21;code<=0x7e;code++)if(![0x22,0x2c,0x3b,0x5c].includes(code))allowed.push(String.fromCharCode(code));
 const cookie='synthetic-spool-session='+allowed.join('');
 const accepted=await status('  '+cookie+'\n');assert.equal(accepted.code,0,accepted.stderr);
 assert.deepEqual(JSON.parse(accepted.stdout),{phase:'complete'});
 assert.deepEqual(received,[{url:'/api/portability/exports/synthetic-spool-1',cookie}]);
 const rejected=[];
 for(let code=0;code<=0x7f;code++)if(code<0x21||code>0x7e||[0x22,0x2c,0x3b,0x5c].includes(code))rejected.push(code);
 for(const code of rejected){
  const before=received.length,result=await status('synthetic-spool-session=before'+String.fromCharCode(code)+'after');
  assert.notEqual(result.code,0,`ASCII ${code} must be refused`);
  assert.equal(received.length,before,`ASCII ${code} must not send a request`);
 }
 console.log(JSON.stringify({status:'pass',door:'CLI status over loopback HTTP',allowedOctets:allowed.length,rejectedOctets:rejected.length,requests:received.length}));
} finally {server.close();await once(server,'close');await rm(directory,{recursive:true,force:true});}
