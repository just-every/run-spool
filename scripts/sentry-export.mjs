#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { removeCredentials, assertNoCredentials, reflectedCredentialMatcher } from '../src/modules/import-kit/src/provenance/credentials.ts';

export const schema = 'sentry-web-api-0-capture-v1';
export const bytesOf = value => Buffer.byteLength(JSON.stringify(value));
export const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(`Sentry capture refused: ${code}`); };
const cursorOf = url => url.searchParams.get('cursor');
/** Sentry's opaque next cursor comes from Link, only when results=true. Never fetch a supplied host. */
export function nextPage(link, current) {
  if (typeof link !== 'string' || link.length > 8192) fail('invalid_link');
  const links = link.split(/,\s*(?=<)/).map(part => {
    const match = /^\s*<([^>]+)>\s*((?:;\s*[\w]+="[^"]*")*)\s*$/.exec(part);
    if (!match) fail('invalid_link');
    const params = Object.fromEntries([...match[2].matchAll(/;\s*(\w+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
    return {url:match[1],...params};
  }).filter(row => row.rel === 'next');
  if (links.length !== 1 || !['true','false'].includes(links[0].results)) fail('next_link_required');
  const next = links[0], url = new URL(next.url,current), here = new URL(current);
  if (url.origin !== here.origin || url.pathname !== here.pathname || url.username || url.password || url.hash) fail('cross_scope_link');
  if (!cursorOf(url) || next.cursor !== cursorOf(url)) fail('cursor_link_mismatch');
  const query = u => [...u.searchParams].filter(([key])=>key!=='cursor').sort();
  if (JSON.stringify(query(url)) !== JSON.stringify(query(here))) fail('query_changed');
  return next.results === 'true' ? url : null;
}
const family = kind => ['keys','ownership'].includes(kind) ? kind : ['teams','members'].includes(kind) ? 'roster' : ['workflows','detectors'].includes(kind) ? 'alerts' : kind;
export const endpoints = (org,project) => ({
  projects:`/api/0/organizations/${org}/projects/`, releases:`/api/0/organizations/${org}/releases/`,
  teams:`/api/0/organizations/${org}/teams/`, members:`/api/0/organizations/${org}/members/`,
  workflows:`/api/0/organizations/${org}/workflows/`, detectors:`/api/0/organizations/${org}/detectors/`,
  keys:`/api/0/projects/${org}/${project}/keys/`, ownership:`/api/0/projects/${org}/${project}/ownership/`,
  issues:`/api/0/projects/${org}/${project}/issues/`, events:`/api/0/projects/${org}/${project}/events/`,
});
function checkEndpoint(kind,project,url,org) {
  const expected=endpoints(encodeURIComponent(org),project===null?'':encodeURIComponent(project))[kind];
  if (!expected || (['keys','ownership','issues','events'].includes(kind) ? !project : project!==null)) fail('unsupported_collection_scope');
  if (kind==='events') {
    if (!url.pathname.startsWith(expected) || !/^[a-f0-9]{32}\/$/.test(url.pathname.slice(expected.length))) fail('event_detail_required');
  } else if (url.pathname!==expected) fail('endpoint_mismatch');
  if (url.username || url.password || url.hash) fail('endpoint_credentials');
  for(const key of url.searchParams.keys())if(!['cursor','per_page','query','start','end','statsPeriod'].includes(key))fail('unsupported_query');
  const size=url.searchParams.get('per_page');if(size!==null&&(!/^[1-9][0-9]*$/.test(size)||Number(size)>100))fail('page_size');
  if(kind==='issues'&&url.searchParams.get('query')!=='')fail('all_issue_states_required');
}
/** Offline, bounded response capture adapter. It makes no provider calls and never accepts auth headers. */
export function exportCapture(capture) {
  if(capture?.schema!==schema || !Array.isArray(capture.collections) || !capture.collections.length || capture.collections.length>100)fail('schema');
  const organization=capture.organization;
  if(!organization||typeof organization.slug!=='string'||!organization.slug||organization.slug.length>200)fail('organization');
  const output={format:'spool-sentry-org-export',version:1,organization,window:capture.window,collections:[],omissions:capture.omissions??[]};
  const inventory=[],redactions=[],cleanPages=new Map(),secrets=[];let totalBytes=0;
 // Gather removals across the entire capture before projecting any page: a
 // credential from a later response must not survive in an earlier one.
 for(const collection of capture.collections){
  if(!Array.isArray(collection.responses))fail('response_pages');
  for(const page of collection.responses){
   if(typeof page?.body!=='string')fail('http_response');
   totalBytes+=Buffer.byteLength(page.body);if(totalBytes>2*1024*1024)fail('capture_byte_limit');
   let response;try{response=JSON.parse(page.body)}catch{fail('invalid_json')}
   const clean=removeCredentials(response);cleanPages.set(page,{response,clean});secrets.push(...clean.secrets);
  }
 }
 const reflected=reflectedCredentialMatcher([...new Set(secrets)]);
  for(const collection of capture.collections) {
    const {kind,project}=collection;
    if(!Array.isArray(collection.responses)||!collection.responses.length||collection.responses.length>(kind==='events'?1000:100))fail('response_pages');
    let expected=null, origin=null; const seen=new Set(),pages=[];
    for(const [index,page] of collection.responses.entries()) {
      if(typeof page.body!=='string'||typeof page.url!=='string'||page.status!==200)fail('http_response');
      const url=new URL(page.url);checkEndpoint(kind,project,url,organization.slug);
      origin??=url.origin;if(url.origin!==origin)fail('origin_changed');
      if(seen.has(url.href))fail('repeated_page');seen.add(url.href);
      if(kind!=='events'&&(index===0 ? cursorOf(url)!==null : url.href!==expected?.href))fail('broken_page_chain');
      const {response,clean}=cleanPages.get(page);
      if(['ownership','events'].includes(kind) ? !response||Array.isArray(response)||typeof response!=='object' : !Array.isArray(response))fail('response_shape');
      if(Array.isArray(response)&&response.length>100)fail('response_page_size');
      let next=null;
      if(kind!=='ownership'&&kind!=='events')next=nextPage(page.link,url);
      if(kind!=='events'&&(index===collection.responses.length-1)!==(next===null))fail('incomplete_page_chain');
      // URL userinfo can repeat in public-key/loader fields as well as secret fields.
      // Remove every reflection, including encoded forms, before constructing custody.
      const screen=(v,path='')=>{
        if(typeof v==='string'&&reflected(v)){clean.removed.push({path,field:{kind:'reflected'}});return '[removed]'}
        if(Array.isArray(v))return v.map((child,i)=>screen(child,path+'/'+i));
        if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([key,child])=>{
          if(reflected(key))fail('reflected_credential_key');
          return [key,screen(child,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'))];
        }));
        return v;
      };
      clean.value=screen(clean.value);assertNoCredentials(clean.value);
      const base=`/collections/${output.collections.length}/pages/${kind==='events'?0:index}/response`;
      for(const item of clean.removed)redactions.push({path:base+(kind==='ownership'?'/0':kind==='events'?`/${index}`:'')+item.path,disposition:'redacted',reason:'Credential removed before upload; original value is not retained.'});
      const rows=['ownership','events'].includes(kind)?[clean.value]:clean.value;
      const sanitizedBody=JSON.stringify(clean.value);
      inventory.push({kind,family:family(kind),project,page:index,cursor:cursorOf(url),nextCursor:next?cursorOf(next):null,
        records:rows.length,sourceBytes:Buffer.byteLength(page.body),sourceSha256:digest(page.body),
        sanitizedBytes:Buffer.byteLength(sanitizedBody),sanitizedSha256:digest(sanitizedBody)});
      pages.push({cursor:index===0?null:cursorOf(url),nextCursor:next?cursorOf(next):null,response:rows});expected=next;
    }
    // Event details are distinct singleton responses; gather them into the existing event collection.
    const held=output.collections.find(c=>c.kind===kind&&c.project===project);
    if(held&&kind!=='events')fail('duplicate_collection');
    if(held)held.pages[0].response.push(...pages[0].response);
    else output.collections.push({kind,project,pages:kind==='events'?[{cursor:null,nextCursor:null,response:pages.flatMap(p=>p.response)}]:pages});
  }
  // Evidence travels in the checked manifest; there are no raw response URLs or headers in custody.
  output.capture={schema,inventory,redactions};
  if(reflected(JSON.stringify(output)))fail('reflected_credential_metadata');
  assertNoCredentials(output);
  return {bundle:output,receipt:{schema,synthetic:capture.synthetic===true,inventory,redactions,
    sourceBytes:inventory.reduce((n,p)=>n+p.sourceBytes,0),sanitizedBytes:inventory.reduce((n,p)=>n+p.sanitizedBytes,0),bundleBytes:bytesOf(output)}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [input,output,receipt,...extra]=process.argv.slice(2);
  if(!input||!output||!receipt||extra.length)throw new Error('Usage: node scripts/sentry-export.mjs CAPTURE.json BUNDLE.json RECEIPT.json');
  const data=await readFile(input);if(data.length>8*1024*1024)fail('capture_file_limit');
  const result=exportCapture(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)));
  await writeFile(output,JSON.stringify(result.bundle),{mode:0o600,flag:'wx'});
  await writeFile(receipt,JSON.stringify(result.receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
}
