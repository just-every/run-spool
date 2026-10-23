import {createHash} from 'node:crypto';
/** CI-only module: secrets are resolved by environment name, never serialized into builds. */
export function deployConfiguration(options) {
  const endpoint = new URL(options.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Endpoint must be an absolute HTTP(S) origin without credentials');
  if (endpoint.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)) throw new Error('Deploy keys require HTTPS outside loopback');
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(options.project ?? '') || typeof options.release !== 'string' || !options.release || typeof options.build !== 'string' || !options.build) throw new Error('Project, release and build are required');
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(options.keyEnv ?? '')) throw new Error('keyEnv must name an environment variable');
  const key = process.env[options.keyEnv];
  if (!key) throw new Error('Deploy key environment variable is empty');
  return { endpoint: endpoint.origin, project: options.project, release: options.release, build: options.build, key };
}
export async function uploadSourceMaps(options, artifacts) {
  const config = deployConfiguration(options);
  if (!Array.isArray(artifacts) || !artifacts.length || artifacts.length > 2000) throw new Error('Supply between one and 2000 source maps per upload');
  const post = async (path, payload) => {
    let response;
    try { response = await fetch(`${config.endpoint}/api/projects/${encodeURIComponent(config.project)}/${path}`, { method:'POST', redirect:'error', headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify(payload) }) }
    catch { throw new Error('Spool upload transport failed') }
    if (!response.ok) { const detail=await response.json().catch(()=>({})); throw new Error(`Spool ${path} refused (HTTP ${response.status}): ${detail.error??'upload refused'}`); }
    return response.json();
  };
  const nameOf=artifact=>artifact.name??artifact.file??artifact.debugId;
  const requiredArtifacts=[...new Set([...(options.requiredMaps??[]),...artifacts.map(nameOf)])].sort();
  await post('releases', { name: config.release, build: config.build,requiredArtifacts });
  const results = [], failures=[];
  for (const artifact of artifacts) {
    if (Buffer.byteLength(JSON.stringify(artifact.map)) > 1024 * 1024) throw new Error('Source map exceeds 1 MiB');
    const {debug_id:_snake,debugId:_camel,...map}=artifact.map;
    const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
    const checksum=createHash('sha256').update(canonical(JSON.parse(JSON.stringify(map)))).digest('hex');
    try { const result = await post('artifacts', { release: config.release, build: config.build, debugId: artifact.debugId, file:nameOf(artifact),checksum, map: artifact.map });
    if(result.digest!==checksum)throw new Error(`${nameOf(artifact)}: stored checksum mismatch`);
    results.push({ debugId: artifact.debugId, digest: result.digest });
    } catch(error){failures.push(`${artifact.file??artifact.debugId}: ${error.message}`)}
  }
  try{await post('artifact-builds/verify',{release:config.release,build:config.build})}catch(error){failures.push(error.message)}
  if(failures.length)throw new Error(failures.join('\n'));
  return { uploaded: results.length, artifacts: results };
}
