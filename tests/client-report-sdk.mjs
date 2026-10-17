import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
// Real SDK and transport: beforeSend drops three captures; Node's public flush
// emits its own client_report to the supplied project's DSN.
export async function emitClientReport(dsn) {
 const entry = require.resolve('@sentry/node');
 const source = `const Sentry=require(${JSON.stringify(entry)});let input='';process.stdin.on('data',value=>input+=value);process.stdin.on('end',async()=>{try{const {dsn}=JSON.parse(input);Sentry.init({dsn,defaultIntegrations:false,sendClientReports:true,beforeSend:()=>null});for(let i=0;i<3;i++)Sentry.captureException(new Error('Filtered checkout validation '+i));if(!await Sentry.flush(10000)||!await Sentry.close(10000))throw new Error('SDK flush not confirmed');process.stdout.write('ok')}catch{process.stderr.write('Node SDK report emission failed');process.exitCode=1}});`;
 const result = await new Promise((resolve,reject) => {
  const child = spawn(process.execPath, ['-e', source], {env:process.env,stdio:['pipe','pipe','pipe']});
  let out='',err='';
  child.stdout.on('data',value=>out+=value);child.stderr.on('data',value=>err+=value);
  child.once('error',reject);child.once('close',code=>resolve({code,out,err}));
  child.stdin.end(JSON.stringify({dsn}));
 });
 assert.equal(result.code,0,result.err);assert.equal(result.out,'ok');
}
