import { readFile } from 'node:fs/promises';
import { AgentError, positiveInteger, validateIssue } from './options.mjs';
import { redact } from './format.mjs';

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
  else throw new AgentError('Unknown read operation.');
  return url;
}

export async function request(config, operation, args) {
  const url = endpoint(config, operation, args);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  try {
    const response = await fetch(url, {
      method: 'GET', redirect: 'manual', signal: controller.signal,
      headers: { authorization: `Bearer ${config.key}`, accept: 'application/json', ...(config.devKey ? { 'x-rer-dev-key': config.devKey } : {}) },
    });
    // Refuse same-origin redirects too: they could expand the exact project/read route.
    if (response.status >= 300 && response.status < 400) throw new AgentError('Redirect refused.');
    if (response.status === 401) throw new AgentError('Not authorized.', 2);
    if (response.status === 403 || response.status === 404) throw new AgentError('Not found or out of scope.', 3);
    if (!response.ok) throw new AgentError('Spool is unavailable.');
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 2 * 1024 * 1024) { controller.abort(); throw new AgentError('Spool response exceeds the read limit.'); }
      chunks.push(chunk);
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AgentError('Spool returned invalid JSON.'); }
    // Existing issue routes return their bounded list; selection never adds a route.
    if (operation === 'list_issues') {
      if (!Array.isArray(data)) throw new AgentError('Spool returned an invalid issue list.');
      if (args?.state === 'open') data = data.filter(issue => issue?.state === 'open');
      if (args?.limit !== undefined) data = data.slice(0, args.limit);
    }
    return redact(data, [config.key, config.devKey]);
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError('Spool is unavailable or the request timed out.');
  } finally {
    // Status errors can leave an unread body holding the CLI open.
    controller.abort();
    clearTimeout(timer);
  }
}
