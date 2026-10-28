import { readFile } from 'node:fs/promises';
import { AgentError, positiveInteger, validateIssue } from './options.mjs';
import { redact } from './format.mjs';
import { PROPOSAL_BYTES } from './proposal.mjs';

export function isLoopback(url) {
  return url.hostname === 'localhost' || url.hostname === '[::1]' || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
}

export async function configuration(options, env = process.env) {
  let root;
  try { root = new URL(env.SPOOL_URL); } catch { throw new AgentError('SPOOL_URL must be an exact project API root.'); }
  if (root.username || root.password || root.search || root.hash || !/^\/api\/projects\/[^/]+\/?$/.test(root.pathname)) throw new AgentError('SPOOL_URL must be an exact project API root without credentials, query, or fragment.');
  if (root.protocol !== 'https:' && !(root.protocol === 'http:' && isLoopback(root))) throw new AgentError('HTTPS is required except on loopback.');
  root.pathname = root.pathname.replace(/\/$/, '');
  let project;
  try { project = decodeURIComponent(root.pathname.split('/').at(-1)); } catch { throw new AgentError('Invalid project API root.'); }
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(project) || project === '.' || project === '..') throw new AgentError('Invalid project API root.');
  root.pathname = `/api/projects/${encodeURIComponent(project)}`;
  let key;
  try {
    if (options.keyFile) key = await readFile(options.keyFile, 'utf8');
    else if (options.keyStdin) {
      key = '';
      for await (const chunk of process.stdin) { key += chunk; if (key.length > 8192) throw new AgentError('Invalid key input.', 2); }
    } else key = env.SPOOL_AGENT_KEY;
  } catch { throw new AgentError('Unable to read agent key.', 2); }
  key = key?.trim();
  if (!key || !/^[A-Za-z0-9._~=-]{1,8192}$/.test(key)) throw new AgentError('An agent key is required through environment, file, or stdin.', 2);
  const devKey = env.SPOOL_DEV_KEY?.trim();
  if (devKey && (!isLoopback(root) || !/^[A-Za-z0-9._~=-]{1,8192}$/.test(devKey))) throw new AgentError('SPOOL_DEV_KEY is permitted only on loopback.');
  return { root, key, devKey, timeout: options.timeout };
}

export function endpoint(config, operation, args = {}) {
  const url = new URL(config.root);
  if (operation === 'list_issues') {
    url.pathname += '/issues';
    const state = args.state ?? 'all';
    if (!['open', 'all'].includes(state)) throw new AgentError('State must be open or all.');
    url.searchParams.set('state', state);
    if (args.limit !== undefined) url.searchParams.set('limit', String(positiveInteger(args.limit, 100)));
  } else if (operation === 'get_packet') url.pathname += `/issues/${encodeURIComponent(validateIssue(args.issue))}/packet`;
  else if (operation === 'get_outcomes') url.pathname += '/outcomes';
  else if (['propose_grouping', 'list_grouping_proposals'].includes(operation)) url.pathname += '/grouping-proposals';
  else throw new AgentError('Unknown operation.');
  return url;
}

export async function rpc(config, method, params = {}) {
  const url = new URL('/mcp', config.root);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  try {
    const response = await fetch(url, {method:'POST',redirect:'manual',signal:controller.signal,
      headers:{authorization:`Bearer ${config.key}`,accept:'application/json, text/event-stream','content-type':'application/json','MCP-Protocol-Version':'2025-11-25',...(config.devKey?{'x-rer-dev-key':config.devKey}:{})},
      body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method,params})});
    if(response.status===401)throw new AgentError('Not authorized.',2);
    if(response.status>=300&&response.status<400)throw new AgentError('Redirect refused.');
    if(!response.ok)throw new AgentError('Spool is unavailable.');
    let bytes=0;const chunks=[];
    for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>2*1024*1024)throw new AgentError('Spool response exceeds the read limit.');chunks.push(chunk);}
    const message=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(message.error)throw new AgentError('Spool refused the request.');
    return redact(message.result,[config.key,config.devKey]);
  }catch(error){if(error instanceof AgentError)throw error;throw new AgentError('Spool is unavailable or the request timed out.');}
  finally{controller.abort();clearTimeout(timer);}
}
export async function request(config, operation, args={}) {
  const names={list_issues:'spool.issues.list',get_packet:'spool.packets.read',get_outcomes:'spool.outcomes.read',list_grouping_proposals:'spool.proposals.list',propose_grouping:'spool.proposals.create'};
  const name=names[operation];if(!name)throw new AgentError('Unknown operation.');
  // Validate the legacy CLI inputs before forwarding to the shared registry.
  endpoint(config,operation,args);
  const project=decodeURIComponent(config.root.pathname.split('/').at(-1));
  if(args.project!==undefined&&args.project!==project)throw new AgentError('Not found or out of scope.',3);
  const answer=await rpc(config,'tools/call',{name,arguments:{...args,project,...operation==='propose_grouping'?{idempotency_key:args.idempotency_key??crypto.randomUUID()}:{} }});
  if(answer?.isError){const code=answer._meta?.['com.runeditrun/error']?.code;throw new AgentError(`Spool refused the request: ${code??'native_refused'}.`,code==='not_found'?3:1);}
  return answer.structuredContent;
}
