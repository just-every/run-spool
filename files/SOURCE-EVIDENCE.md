# Read-only source evidence
SHA: 4c14f5433cc7885a486db254549079d36443c37a

## tests/sdk-runtimes.mjs
```text
17: const sequence=['handled','crash','handled'];
18: const temporary=await mkdtemp(join(tmpdir(),'spool-runtimes-'));
19: let worker;
20: try{
21:  worker=await startTestWorker(15540);
22:  const {origin}=worker,cookie=await signIn(origin),app=api(origin,cookie);
23:  for(const name of names){
24:   const runtime=(await import(available[name])).default,dir=join(temporary,name);
25:   await runtime.prepare(dir);
26:   // Each SDK reads its release (and, where it supports one, its dist) from the standard variables.
27:   const identity={SENTRY_RELEASE:`synthetic-spool-${name}@1.0.0`,SENTRY_DIST:'synthetic-spool-1'};
28:   const execute=async(dsn,modes=sequence)=>{const results=[];for(const mode of modes){const c=runtime.command(mode,dir,dsn);results.push({mode,...await run(c.command,c.args,{cwd:c.cwd,env:{...identity,...c.env},unset:c.unset})})}return results};
29:   const reference=await referenceCollector();
30:   const referenceRuns=await execute(reference.dsn);await reference.close();
31:   for(const result of referenceRuns)assert.equal(result.mode==='crash'?result.code!==0:result.code===0,true,`${name} reference ${result.mode} exit ${result.code}: ${result.stderr.slice(-600)}`);
32:   const types=counts(reference.sent.map(item=>item.type));
33:   for(const type of runtime.required)assert.ok(types.get(type),`${name} SDK sent no ${type} item with its default/wizard options (sent ${[...types].join(',')})`);
34:   const discards=discardedOutcomes(reference.sent);
35:   if(runtime.discards)assert.deepEqual([...discards].sort(),runtime.discards,`${name}: real client reports contain every before_send discard with its exact category and quantity`);
36:   const project=await app.json('/api/projects','POST',{id:`rt-${name}`,name:`${name} runtime`});
37:   const spoolRuns=await execute(project.dsn);
38:   for(const result of spoolRuns)assert.equal(result.mode==='crash'?result.code!==0:result.code===0,true,`${name} Spool ${result.mode} exit ${result.code}: ${result.stderr.slice(-600)}`);
39:   // Reconcile accepted, unsupported and client-discarded outcomes with what the SDK sent.
40:   const outcomes=await outcomeMap(app,project.id),expected=expectedOutcomes(reference.sent);
41:   assert.deepEqual([...outcomes].sort(),[...expected].sort(),`${name}: Spool outcomes reconcile with SDK-sent items`);
42:   const details=await issueDetails(app,project.id);
43:   assert.equal(details.reduce((n,d)=>n+d.issue.count,0),types.get('event'),`${name}: every SDK error event is a persisted occurrence`);
44:   if(runtime.discards){
45:    const {usage}=await app.json('/api/organization/usage');
46:    const usageDiscards=usage.filter(row=>row.project===project.id&&row.reason.startsWith('client_discarded:')).map(row=>[row.reason,row.count]);
47:    assert.deepEqual(usageDiscards.sort(),[...discards].sort(),`${name}: usage retains the exact SDK discard reasons, categories and quantities`);
48:    assert.ok(details.every(d=>d.events.every(e=>e.event.message!=='synthetic-spool-discard')),`${name}: a before_send discard creates no occurrence`);
```
```text
63:   // Failure handling: a wrong key or an unreachable intake never breaks the application.
64:   const before=await app.json(`/api/projects/${project.id}/issues`);
65:   const url=new URL(project.dsn);
66:   const forged=`${url.protocol}//${(url.username[0]==='0'?'1':'0')+url.username.slice(1)}@${url.host}${url.pathname}`;
67:   for(const dsn of [forged,`http://${url.username}@127.0.0.1:1/1`]){const [handledRun]=await execute(dsn,['handled']);assert.equal(handledRun.code,0,`${name}: SDK failure to deliver must not fail the app: ${handledRun.stderr.slice(-400)}`)}
68:   const after=await app.json(`/api/projects/${project.id}/issues`);
69:   assert.deepEqual(after.map(i=>[i.id,i.count]),before.map(i=>[i.id,i.count]),`${name}: refused or undeliverable events create nothing`);
70:   const proof=await runtime.verify?.({app,project,details,dir,origin,cookie,referenceSent:reference.sent});
71:   if(runtime.cause)await causeChainProof({runtime,app,dir,origin,cookie,identity});
72:   // The handled occurrence reads the same through the UI, at desktop and phone width.
73:   const outer=runtime.chain.at(-1);
74:   await readScreens(origin,cookie,[{name:`${name}-issue`,path:`/projects/${project.id}/issues/${handled.issue.id}`,check:async page=>{await page.locator('article.exception h3').filter({hasText:outer}).first().waitFor();if(runtime.checkIssue)await runtime.checkIssue({page,app,project,handled});await proof?.checkIssue(page,handled)}}]);
75:   console.log(JSON.stringify({runtime:name,sdk:runtime.version,sent:Object.fromEntries(types),outcomes:Object.fromEntries(outcomes),identity:[...sent]}));
76:  }
77: }finally{await worker?.stop();await rm(temporary,{recursive:true,force:true})}
```

## tests/runtimes/harness.mjs
```text
1: import assert from 'node:assert/strict';
2: import {createServer} from 'node:http';
3: import {spawn} from 'node:child_process';
4: import {brotliDecompressSync,gunzipSync,inflateSync} from 'node:zlib';
5: import {objectJson,parseEnvelope,unsupportedReason} from '../../src/domain/sentry/wire.ts';
6: import {absentDist} from '../../src/domain/releases/build.ts';
7: 
8: // Reference collector: the same unmodified SDK program first sends to this plain HTTP
9: // server, so the test knows exactly which envelope items the SDK itself produced.
10: export async function referenceCollector(){
11:  const sent=[];
12:  const server=createServer(async(req,res)=>{
13:   res.setHeader('Access-Control-Allow-Origin','*');
14:   res.setHeader('Access-Control-Allow-Headers','Content-Type,sentry-trace,baggage');
15:   if(req.method==='OPTIONS'){res.end();return}
16:   const chunks=[];for await(const chunk of req)chunks.push(chunk);
17:   let bytes=Buffer.concat(chunks);const encoding=req.headers['content-encoding'];
18:   if(encoding==='gzip')bytes=gunzipSync(bytes);else if(encoding==='deflate')bytes=inflateSync(bytes);else if(encoding==='br')bytes=brotliDecompressSync(bytes);
19:   if(/envelope/.test(req.url)){const {items}=parseEnvelope(bytes);for(const item of items)sent.push({type:item.header.type,header:item.header,bytes:item.bytes})}
20:   res.setHeader('Content-Type','application/json');res.end('{}');
21:  });
22:  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
23:  const {port}=server.address();
24:  return {dsn:`http://reference@127.0.0.1:${port}/1`,sent,close:()=>new Promise(resolve=>server.close(resolve))};
25: }
26: 
27: export function run(command,args,{cwd,env={},unset=[],timeout=900_000}={}){
28:  return new Promise((resolve,reject)=>{
29:   const inherited={...process.env};for(const name of unset)delete inherited[name];
30:   const child=spawn(command,args,{cwd,env:{...inherited,...env},stdio:['ignore','pipe','pipe'],detached:false});
31:   let stdout='',stderr='';child.stdout.on('data',d=>stdout=(stdout+d).slice(-20000));child.stderr.on('data',d=>stderr=(stderr+d).slice(-20000));
32:   const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
33:   child.once('error',error=>{clearTimeout(timer);reject(error)});
34:   child.once('exit',code=>{clearTimeout(timer);resolve({code,stdout,stderr})});
35:  });
36: }
37: 
38: export async function runOk(command,args,options){
39:  const result=await run(command,args,options);
40:  assert.equal(result.code,0,`${command} ${args.slice(0,3).join(' ')} failed:\n${result.stderr||result.stdout}`);return result;
41: }
42: 
43: export function counts(items){const map=new Map();for(const type of items)map.set(type,(map.get(type)??0)+1);return map}
44: 
45: export function discardedOutcomes(sent){
46:  const discarded=new Map();
47:  for(const item of sent.filter(item=>item.type==='client_report')){
48:   for(const {category,reason,quantity} of objectJson(item.bytes).discarded_events??[]){
49:    const key=`client_discarded:${category}:${reason}`;
50:    discarded.set(key,(discarded.get(key)??0)+quantity);
51:   }
52:  }
53:  return discarded;
54: }
55: 
56: // What Spool must show in project outcomes for the items one SDK actually sent.
57: export function expectedOutcomes(sent){
58:  const expected=new Map(),add=(reason,n=1)=>expected.set(reason,(expected.get(reason)??0)+n);
59:  for(const item of sent){
60:   if(item.type==='event')add('accepted');
61:   else if(item.type==='client_report')continue;
62:   else if(item.type==='feedback'||item.type==='user_report')add('feedback_accepted');
63:   else if(item.type==='session'||item.type==='sessions')add('session_stored');
64:   else if(item.type==='check_in')add('check_in_unrouted');
65:   else add(unsupportedReason(item.type));
66:  }
67:  for(const [reason,quantity] of discardedOutcomes(sent))add(reason,quantity);
68:  return expected;
69: }
70: 
71: // The release and dist each SDK error event carried ("" and the absent-dist build when none).
72: export function sentIdentities(sent){
73:  return new Set(sent.filter(item=>item.type==='event').map(item=>{const event=objectJson(item.bytes);return JSON.stringify([event.release??'',event.dist==null?absentDist:event.dist])}));
74: }
75: 
76: export function api(origin,cookie){
77:  const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:JSON.stringify(body)}:{}});
78:  const json=async(path,method,body,headers)=>{const response=await request(path,method,body,headers);assert.ok(response.ok,`${method??'GET'} ${path}: HTTP ${response.status}`);return response.json()};
79:  return {request,json};
80: }
81: 
82: export async function issueDetails(app,project){
83:  const out=[];
84:  for(const issue of await app.json(`/api/projects/${project}/issues`)){
85:   const list=await app.json(`/api/projects/${project}/issues/${issue.id}/events`);
86:   const events=[];
```

## tests/runtimes/ruby.mjs
```text
1: import {cp} from 'node:fs/promises';
2: import {resolve} from 'node:path';
3: import {runOk} from './harness.mjs';
4: 
5: const here=resolve(import.meta.dirname,'ruby');
6: const bundle=dir=>({BUNDLE_PATH:resolve(dir,'vendor'),BUNDLE_GEMFILE:resolve(dir,'Gemfile')});
7: export default {
8:  name:'ruby',sdk:'sentry.ruby',version:'sentry-ruby 7.1.0',
9:  required:['event','sessions','transaction','log','attachment','check_in','client_report'],
10:  discards:[['client_discarded:error:before_send',2]],
11:  chain:['ZeroDivisionError','ArgumentError'],
12:  async prepare(dir){
13:   await cp(here,dir,{recursive:true});
14:   await runOk('bundle',['install','--quiet'],{cwd:dir,env:bundle(dir)});
15:  },
16:  command(mode,dir,dsn,cwd=dir){return {command:'bundle',args:['exec','ruby',resolve(dir,'app.rb'),mode],cwd,env:{...bundle(dir),SPOOL_FIXTURE_DSN:dsn}}},
17: };
```

## tests/runtimes/ruby/app.rb
```text
1: # Unmodified sentry-ruby program: the DSN is the only value that changes between runs.
2: require 'rack'
3: require 'rack/mock_request'
4: require 'sentry-ruby'
5: 
6: Sentry.init do |config|
7:   config.dsn = ENV.fetch('SPOOL_FIXTURE_DSN')
8:   config.environment = 'compatibility'
9:   config.traces_sample_rate = 1.0
10:   config.before_send = lambda do |event, _hint|
11:     event.message == 'synthetic-spool-discard' ? nil : event
12:   end
13: end
14: 
15: def charge(_note)
16:   password = 'synthetic-spool-1'
17:   begin
18:     10 / 0
19:   rescue ZeroDivisionError
20:     raise ArgumentError, 'checkout quantity rejected'
21:   end
22: end
23: 
24: def flush_telemetry
25:   yield
26: rescue Sentry::ExternalError => failure
27:   # Delivery failure must not turn a handled application error into a process failure.
28:   warn "Sentry delivery failed: #{failure.message}"
29: end
30: 
31: transaction = Sentry.start_transaction(name: 'checkout', op: 'task')
32: Sentry.get_current_scope.set_span(transaction)
33: span = transaction.start_child(op: 'db', description: 'load cart')
34: Sentry.logger.info('cart loaded')
35: span.finish
36: Sentry.get_current_scope.add_attachment(bytes: 'synthetic-spool-attachment', filename: 'cart.txt')
37: 
38: if ARGV[0] == 'handled'
39:   begin
40:     charge('synthetic-spool-note')
41:   rescue ArgumentError => failure
42:     Sentry.capture_exception(failure)
43:   end
44:   Sentry.capture_message('synthetic-spool-discard')
45:   Sentry.capture_check_in('nightly-sync', :ok, duration: 1)
46:   transaction.finish
47:   # Flush buffered logs while the worker still accepts work, then let the asynchronous
48:   # before_send finish before close emits the SDK's pending client report.
49:   flush_telemetry { Sentry.get_current_client.flush }
50:   Sentry.background_worker.shutdown_timeout = 10
51:   Sentry.background_worker.shutdown
52:   flush_telemetry { Sentry.close }
53: else
54:   # Ruby has no global crash hook; web apps report unhandled errors through the Rack middleware,
55:   # which also tracks the request's session (request-mode release health).
56:   app = Sentry::Rack::CaptureExceptions.new(->(_env) { charge('synthetic-spool-note') })
57:   transaction.finish
58:   Rack::MockRequest.new(app).get('/checkout')
59: end
```

## tests/runtimes/ruby/Gemfile
```text
1: source 'https://rubygems.org'
2: gem 'sentry-ruby', '7.1.0'
3: gem 'rack', '3.2.4'
```

## src/domain/sentry/client-reports.ts
```text
22: }
23: export function clientReportCounts(bytes: Uint8Array): Map<string, number> {
24:  const invalid = () => new SentryWireError('client_report_invalid', 422);
25:  if (bytes.byteLength > 65536) throw invalid();
26:  let report;
27:  try { report = objectJson(bytes); } catch { throw invalid(); }
28:  if (!validTimestamp(report.timestamp) ||
29:      !Array.isArray(report.discarded_events) || report.discarded_events.length > 100) throw invalid();
30:  const counts = new Map<string, number>();
31:  for (const item of report.discarded_events) {
32:   if (!item || typeof item !== 'object' || Array.isArray(item) ||
33:       typeof item.reason !== 'string' || !token.test(item.reason) ||
34:       typeof item.category !== 'string' || !token.test(item.category) ||
35:       !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > maximumQuantity) throw invalid();
36:   const reason = `client_discarded:${item.category}:${item.reason}`;
37:   if (!isClientReportOutcome(reason)) throw invalid();
38:   const quantity = (counts.get(reason) ?? 0) + item.quantity;
39:   if (quantity > maximumQuantity) throw invalid();
40:   counts.set(reason, quantity);
41:  }
42:  return counts;
43: }
```

## src/domain/sentry/routes.ts
```text
51:     const auth=await sentryAuthority(c,envelope.header);if('response' in auth)return auth.response;scope=auth.scope;
52:     type Privacy={jobs:D1PreparedStatement[]};
53:     let eventScrubbingKey:Awaited<ReturnType<typeof prepareScrubbing>>['key']=null;
54:     const dropped=new Map<string,number>(),clientDiscarded=new Map<string,number>(),events:{event:any;digest:string;identity?:Awaited<ReturnType<typeof prepareEventIdentity>>;privacy?:Privacy}[]=[],feedback=[],checkIns:typeof envelope.items=[],sessions:typeof envelope.items=[];
55:     let clientReports=0,invalidReports=0,filteredReports=0;
56:     for(const item of envelope.items){
57:       if(item.header.type==='client_report'){
58:         clientReports++;
59:         try{const counts=clientReportCounts(item.bytes);if((await filterCategory(c,scope)).length){filteredReports++;continue}for(const [reason,count] of counts)clientDiscarded.set(reason,(clientDiscarded.get(reason)??0)+count)}
60:         catch(error){if(!(error instanceof SentryWireError))throw error;invalidReports++;dropped.set('client_report_invalid',invalidReports)}
61:         continue;
62:       }
63:       if(item.header.type==='feedback'||item.header.type==='user_report'){
```

## .github/workflows/verify.yml
```text
115:   runtimes:
116:     # Real Sentry SDK programs, one runtime per job, against Spool's public intake.
117:     name: runtime (${{ matrix.runtime }})
118:     needs: [plan, build]
119:     if: ${{ needs.plan.outputs.coverage == 'full' && (needs.plan.outputs.tier == 'push' || needs.plan.outputs.tier == 'all') }}
120:     runs-on: ubuntu-24.04
121:     timeout-minutes: ${{ matrix.runtime == 'electron' && 15 || 10 }}
122:     env:
123:       RER_SERVERS_DISK_FLOOR_GIB: '4'
124:     strategy:
125:       fail-fast: false
126:       matrix:
127:         runtime: [electron, python, go, java, ruby, php, dotnet, rust, elixir, node]
128:     steps:
129:       - uses: actions/checkout@v4
130:         with:
131:           persist-credentials: false
```
```text
169:           distribution: temurin
170:           java-version: '21'
171:       - if: matrix.runtime == 'ruby'
172:         uses: ruby/setup-ruby@v1
173:         with:
174:           ruby-version: '3.3'
175:       - if: matrix.runtime == 'php'
```
```text
260:           restore-keys: |
261:             electron-${{ runner.os }}-
262:       - name: Run ${{ matrix.runtime }} SDK journey
263:         env:
264:           CARGO_TARGET_DIR: ${{ runner.temp }}/cargo-target
265:         run: |
266:           if [ "${{ matrix.runtime }}" = electron ]; then
267:             xvfb-run -a node tests/sdk-runtimes.mjs electron
268:           else
269:             node tests/sdk-runtimes.mjs "${{ matrix.runtime }}"
270:           fi
271:       - uses: actions/upload-artifact@v4
```
```text
434:   shards:
435:     # Preserve Spool's existing runtime and test matrices beneath one push proof.
436:     # Base's planner checks these exact names before reusing complete coverage.
437:     name: shards (${{ matrix.name }})
438:     needs: [plan, build, runtimes, tests, commands]
439:     if: ${{ always() && needs.plan.result == 'success' && needs.plan.outputs.has_shards == 'true' }}
440:     runs-on: ubuntu-24.04
441:     timeout-minutes: 1
442:     strategy:
443:       fail-fast: false
444:       matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
445:     steps:
446:       - name: Require every job in this coverage partition
447:         env:
448:           SHARD: ${{ matrix.name }}
449:           BUILD: ${{ needs.build.result }}
450:           RUNTIMES: ${{ needs.runtimes.result }}
451:           TESTS: ${{ needs.tests.result }}
452:           COMMANDS: ${{ needs.commands.result }}
453:         run: |
454:           set -euo pipefail
455:           case "$SHARD" in
456:             spool) test "$BUILD" = success && test "$RUNTIMES" = success && test "$TESTS" = success ;;
457:             commands) test "$COMMANDS" = success ;;
458:             *) exit 1 ;;
459:           esac
```
```text
508:   verify:
509:     needs: [plan, shards, light, full-push-proof, nightly-proof]
510:     if: ${{ always() }}
511:     runs-on: ubuntu-24.04
512:     timeout-minutes: 1
513:     steps:
514:       - name: Require the selected coverage and its proof
515:         env:
516:           PLAN: ${{ needs.plan.result }}
517:           SHARDS: ${{ needs.shards.result }}
518:           LIGHT: ${{ needs.light.result }}
519:           PUSH_PROOF: ${{ needs.full-push-proof.result }}
520:           NIGHTLY_PROOF: ${{ needs.nightly-proof.result }}
521:           COVERAGE: ${{ needs.plan.outputs.coverage }}
522:           HAS_SHARDS: ${{ needs.plan.outputs.has_shards }}
523:           SKIP: ${{ needs.plan.outputs.skip }}
524:         run: |
525:           set -euo pipefail
526:           test "$PLAN" = success
527:           case "$PUSH_PROOF:$NIGHTLY_PROOF" in
528:             *failure*|*cancelled*) exit 1 ;;
529:           esac
530:           case "$COVERAGE" in
531:             reuse) test "$SKIP" = true && test "$SHARDS" = skipped && test "$LIGHT" = skipped ;;
532:             light) test "$SKIP" = false && test "$LIGHT" = success && test "$SHARDS" = skipped ;;
533:             full) test "$LIGHT" = skipped && { test "$SHARDS" = success || { test "$HAS_SHARDS" = false && test "$SHARDS" = skipped; }; } ;;
534:             *) exit 1 ;;
535:           esac
```
