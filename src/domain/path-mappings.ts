import { file, canonical, type Envelope } from './privacy.ts';
export type PathMapping = { from: string; to: string };
export function pathMappings(value: unknown): PathMapping[] {
 if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Path mappings require 1 to 20 prefixes');
 const seen = new Set<string>();
 return value.map(row => {
  if (!row || Object.keys(row).sort().join() !== 'from,to') throw new Error('Path mapping requires from and to');
  const {from,to} = row;
  // Prefixes denote directory boundaries too: a terminal home-directory name
  // must be scrubbed even though a captured file would have another segment.
  for (const [index,path] of [from,to].entries()) if (typeof path !== 'string' || path.length > 512 || !path || /[\\%?#\x00-\x20\x7f]/.test(path) || (!(index===1 && path==='.') && /(^|\/)\.{1,2}(\/|$)/.test(path)) || path.includes('//') || path.endsWith('/') || file(path+'/','go').slice(0,-1) !== path) throw new Error('Canonical private-safe path prefix required');
  if (to.startsWith('/') || to.includes(':')) throw new Error('Mapping target must be repository relative');
  if (seen.has(from)) throw new Error('Duplicate mapping prefix'); seen.add(from);
  return {from,to};
 }).sort((a,b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
}
export async function sourceDiagnostics(db: D1Database, project: string, event: Envelope) {
 if (event.language === 'python') return event.frames.map(generated => ({generated,status:'python_source',source:'reported_source_path'}));
 const row = await db.prepare('SELECT m.payload,m.build,d.repository,d.commit_sha FROM deployment_path_mappings m JOIN deployment_manifests d ON d.project=m.project AND d.release=m.release AND d.environment=m.environment JOIN releases r ON r.project=m.project AND r.name=m.release AND r.build=m.build WHERE m.project=? AND m.release=? AND m.build=? AND m.environment=?').bind(project,event.release,event.build,event.environment).first<any>();
 const mappings = row ? pathMappings(JSON.parse(row.payload)).sort((a,b)=>b.from.length-a.from.length) : [];
 return event.frames.map(generated => {
  const mapping = mappings.find(m => generated.file === m.from || generated.file.startsWith(m.from + '/'));
  const suffix = mapping ? generated.file.slice(mapping.from.length) : '';
  const target = mapping ? mapping.to==='.'?suffix.slice(1)||'.':mapping.to+suffix : '';
  if (!mapping || file(target,'go')!==target || /(^|\/)\.{1,2}(\/|$)/.test(suffix) || /[\\%?#\x00-\x20\x7f]/.test(suffix)) return {generated,status:row?'go_path_unmatched':'go_mapping_unavailable'};
  return {generated,status:'go_path_mapped',source:'owner_or_deploy_key_recorded',original:{file:target,line:generated.line,column:generated.column,function:generated.function},mapping:{...mapping,repository:row.repository,commitSha:row.commit_sha,release:event.release,build:event.build,environment:event.environment}};
 });
}
export function mappingStatements(db: D1Database, project:string, release:string, build:string, environment:string, mappings?:PathMapping[]) {
 if (!mappings) return [];
 const payload=canonical(mappings),s=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 return [
  s('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM deployment_path_mappings WHERE project=? AND release=? AND environment=?) OR EXISTS(SELECT 1 FROM deployment_path_mappings WHERE project=? AND release=? AND environment=? AND build=? AND payload=?) THEN 1 ELSE 0 END',project,release,environment,project,release,environment,build,payload),
  s('INSERT INTO deployment_path_mappings VALUES(?,?,?,?,?) ON CONFLICT(project,release,environment) DO NOTHING',project,release,environment,build,payload),
 ];
}
