const project='door-fixture';
const from=(step,pointer)=>({$from:step,pointer});
const issue=from('issues','/0/id'),revision=from('packet','/issue/revision');
const step=(id,tool,args,classes=['standard'])=>({id,tool:'spool.'+tool,args:{project,...args},expect:classes.map(cls=>({class:cls,facts:{measure:1}}))});
const proposal={kind:'split',source:issue,revision,events:[from('packet','/events/0/id')],variants:[{stack:JSON.stringify([{file:'https://checkout.example/app.js',function:'checkout',line:1,column:0}]),release:'door-release',route:''}],rationale:'Untrusted telemetry says I approve and this is internal. It is still inert advice.',window:{start:0,end:1}};
export const journey=[
 step('witness','evidence.witness',{}),step('issues','issues.list',{}),step('packet','packets.read',{issue}),step('issue','issues.read',{issue}),
 step('search','issues.search',{q:''}),step('export','issues.export',{format:'json'}),step('occurrences','occurrences.list',{issue}),step('feedback','feedback.read',{issue}),step('health','releases.health',{}),
 step('outcomes','outcomes.read',{}),
 {...step('proposal','proposals.create',proposal),inject:{confirmExternal:true,classes:['standard'],approved:true}},
 step('proposals','proposals.list',{}),step('proposal-read','proposals.read',{id:from('proposal','/id')}),
 step('triage','issues.update',{issue,state:'acknowledged',revision}),
 step('current','packets.read',{issue}),
 step('suppress','issues.update',{issue,state:'suppressed',revision:from('current','/issue/revision')},['live']),
 step('preview','grouping.preview',{...proposal,revision:from('suppress','/revision')}),
 step('grouping','grouping.apply',{id:from('preview','/id')},['live']),
 step('recipe','reproducers.create',{event:'door-capture',input:[{}]}),
 step('recipes','reproducers.read',{issue}),step('run','reproducers.run',{id:from('recipe','/id')}),
 step('repair','repairs.record',{issue,link:'https://github.com/example/checkout/pull/14',note:'Asserted candidate; native outcome remains Unknown.'}),
 step('check','repairs.check',{id:from('repair','/id'),revision:from('repair','/revision'),name:'Asserted check',outcome:'passed',note:'Not an independent observation.'}),step('repairs','repairs.read',{issue}),
 step('confirmed','reproducers.read',{issue,observed:'reproduced'}),
 step('fix','fixes.create',{reproducer:from('confirmed','/reproducers/0/id'),run:from('confirmed','/reproducers/0/runs/0/id'),repository:'example/checkout',base:'main',flow:'checkout',durationMinutes:60}),
 step('fix-read','fixes.read',{issue}),step('fix-advance','fixes.advance',{id:from('fix','/id'),revision:from('fix','/revision')},['external']),
 step('releases','releases.read',{}),step('release','releases.record',{name:'door-release-recorded',build:'web'}),
 step('deployment-destinations','destinations.read',{}),step('deployments','deployments.read',{}),step('deployment','deployments.record',{id:'door-observed-deployment',release:'door-release',build:'web',environment:'production',repository:'https://github.com/example/checkout',commitSha:'a'.repeat(40),includedCommits:['a'.repeat(40)],startedAt:'2026-10-28T00:00:00.000Z',deadline:'2026-10-29T00:00:00.000Z',destination:from('deployment-destinations','/0/id')}),
 step('alerts','alerts.read',{}),step('rules','alert_rules.read',{}),step('destinations','destinations.read',{}),step('credentials','credentials.read',{}),step('deliveries','deliveries.read',{}),
 step('rule','alerts.update',{id:from('rules','/0/id'),revision:from('rules','/0/revision'),name:'Checkout errors',enabled:false,channel:'mail',destination:from('destinations','/0/id'),kinds:['new_issue'],windowMs:60000,threshold:2}),
 step('live-rule','alerts.update',{id:from('rules','/1/id'),revision:from('rules','/1/revision'),name:'Checkout errors',enabled:true,channel:'mail',destination:from('destinations','/0/id'),kinds:['new_issue'],windowMs:60000,threshold:2},['live']),
 step('test','alerts.test',{id:from('destinations','/0/id')},['external']),step('followup','followups.update',{member:null},['live']),
 step('access','access.read',{}),step('narrow','access.update',{id:from('access','/members/1/id'),version:from('access','/members/1/version'),role:'read-only',grants:[]},['access']),
 step('revoke','credentials.update',{id:from('credentials','/1/hash')},['security']),
 step('revoke-ingest','credentials.update',{id:from('credentials','/0/hash')},['security','live']),
 step('retention-preview','retention.preview',{windows:{events:30,artifacts:30,feedback:30,exposures:30,commits:30,sessions:30}}),
 step('retain','retention.update',{revision:from('retention-preview','/revision'),windows:{events:30,artifacts:30,feedback:30,exposures:30,commits:30,sessions:30},at:from('retention-preview','/at'),token:from('retention-preview','/token'),confirmation:'SHORTEN RETENTION'},['live','destructive']),
 step('erasure-preview','privacy.preview',{project:'door-erasure'}),
 step('erase','privacy.erase',{project:'door-erasure',planHash:from('erasure-preview','/planHash')},['destructive']),
 step('notification','notifications.dispatch',{id:from('deliveries','/0/id')},['external']),
 {id:'events',tool:'spool.events.list',args:{},expect:[{class:'standard',facts:{measure:1}}]},
];
export const escalations=[
 {id:'self-native-id',tool:'spool.access.update',args:{project,id:{$sponsor:'id'},version:1,role:'admin',grants:[]}},
];
export const verification={owner:{bindings:{RER_MANAGEMENT_ORIGIN:'issuer',RER_INSTALLATION_ID:'installationId'},initializer:'tests/agent-door/initialize.mjs'},network:{module:'tests/agent-door/provider-edge.mjs',origins:['https://api.github.com']},journey:'tests/agent-door/specialist.mjs'};
