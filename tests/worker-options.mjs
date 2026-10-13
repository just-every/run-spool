import assert from 'node:assert/strict';
import {lstat,readFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {productionModules} from '../scripts/base-onboarding/production-modules.mjs';
import {miniflareAssets} from './product-assets.mjs';

// Wrangler 4.129.1's DEFAULT_MODULE_RULES, appended after emitted rules just as
// unstable_getMiniflareWorkerOptions does. Avoid its implicit .dev.vars loading:
// this fixture's bindings are emitted vars plus the existing authBindings only.
const defaultRules=[
 {type:'Text',globs:['**/*.txt','**/*.html','**/*.sql']},
 {type:'Data',globs:['**/*.bin']},
 {type:'CompiledWasm',globs:['**/*.wasm','**/*.wasm?module']}
];

// Wrangler 4.129.1 config-schema.json, convertConfigToBindings and
// buildMiniflareOptions: only vars, assets and the local DB bindings are supported.
// Reject every other binding family, plus runtime modes/handlers this HTTP
// fixture does not implement. Do not silently erase an emitted capability.
const unsupportedRuntime=[
 'kv_namespaces','send_email','r2_buckets','vectorize','ai_search_namespaces',
 'ai_search','agent_memory','websearch','hyperdrive','services',
 'analytics_engine_datasets','browser','ai','images','media','stream',
 'version_metadata','mtls_certificates','dispatch_namespaces','pipelines',
 'secrets_store_secrets','artifacts','unsafe_hello_world','flagship','ratelimits',
 'worker_loaders','vpc_services','vpc_networks','wasm_modules','text_blobs',
 'data_blobs','workflows','durable_objects','queues','logfwdr','unsafe',
 'containers','cloudchamber','migrations','exports','connect','tail_consumers',
 'streaming_tail_consumers','site','access','cache','limits',
 'env','previews','secrets','addresses','route','routes','first_party_worker'
];
// Normalized emitted configs include these empty wrappers even without bindings.
const emptyCollections={
 durable_objects:['bindings'],queues:['producers','consumers'],logfwdr:['bindings']
};
function emptyCapability(value,collections=[]) {
 if(value===undefined)return true;
 if(Array.isArray(value))return value.length===0;
 return value!==null&&typeof value==='object'&&Object.entries(value).every(
  ([key,entries])=>collections.includes(key)&&Array.isArray(entries)&&entries.length===0
 );
}

export async function emittedWorkerOptions(configPath,miniflare) {
 const config=JSON.parse(await readFile(configPath,'utf8')),directory=dirname(configPath);
 for(const field of unsupportedRuntime)assert.ok(emptyCapability(config[field],emptyCollections[field]),`Unsupported emitted runtime capability: ${field}`);
 assert.ok(config.triggers===undefined||(config.triggers!==null&&typeof config.triggers==='object'&&!Array.isArray(config.triggers)&&Object.keys(config.triggers).every(key=>key==='crons'||key==='events')),'Unsupported emitted trigger configuration');
 assert.ok(config.triggers?.crons===undefined||(Array.isArray(config.triggers.crons)&&config.triggers.crons.every(cron=>typeof cron==='string'&&cron.length)),'Emitted cron schedules must be nonempty strings');
 assert.ok(config.triggers?.events===undefined||(Array.isArray(config.triggers.events)&&config.triggers.events.length===0),'Emitted event subscriptions are unsupported');
 const triggers=(config.triggers?.crons??[]).map(schedule=>({type:'scheduled',schedule}));
 assert.equal(config.no_bundle,true,'Fixture requires the emitted unbundled module graph');
 assert.ok(typeof config.main==='string'&&config.main.length,'Emitted main is required');
 assert.ok(typeof config.assets?.directory==='string'&&config.assets.directory.length,'Emitted assets are required');
 config.main=resolve(directory,config.main);
 config.assets.directory=resolve(directory,config.assets.directory);
 assert.ok((await lstat(config.main)).isFile(),'Emitted main must be a regular file');
 assert.ok((await stat(config.assets.directory)).isDirectory(),'Emitted asset directory is required');
 assert.ok(config.find_additional_modules!==false,'Emitted module discovery must be enabled');
 assert.ok(config.base_dir===undefined||resolve(directory,config.base_dir)===dirname(config.main),'Alternate emitted module roots are unsupported');
 assert.ok(Array.isArray(config.rules),'Emitted module rules are required');
 assert.ok(Array.isArray(config.d1_databases)&&config.d1_databases.length===1,'Fixture requires exactly one emitted D1 database');
 const [database]=config.d1_databases;
 assert.ok(database?.binding==='DB','Fixture requires the emitted Spool DB binding');
 assert.ok(typeof database.database_id==='string'&&database.database_id.length,'Emitted D1 identity is required');
 assert.ok(database.remote===undefined||database.remote===false,'Remote emitted D1 is unsupported');
 assert.ok(database.preview_database_id===undefined||database.preview_database_id===database.database_id,'Alternate emitted D1 preview identity is unsupported');
 const rules=[...config.rules,...defaultRules].map(({type,globs,fallthrough})=>({type,include:globs,fallthrough}));
 return {database,triggers,worker:{
  name:config.name,...await productionModules(config.main,rules,miniflare),
  compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
  bindings:config.vars,assets:miniflareAssets(config),d1Databases:{[database.binding]:database.database_id}
 }};
}
