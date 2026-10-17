import { pathMappings } from './path-mappings';
import { file, scrub, type Envelope } from './privacy';

export type RepositorySourceLink =
 | { status: 'linked'; url: string; provider: 'github' | 'gitlab' | 'bitbucket'; path: string; line: number; commitSha: string; source: 'owner_or_deploy_key_recorded'; verified: false }
 | { status: 'unmapped'; reason: 'deployment_unavailable' | 'repository_unsupported' | 'mapping_unavailable' | 'mapping_invalid' | 'path_unmatched' | 'original_source_unavailable' | 'unsafe_source_path' | 'historical_source_unverified' };

function repository(value: unknown) {
 if (typeof value !== 'string' || scrub(value) !== value) return null;
 try {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.href !== value) return null;
  const providers: Record<string, 'github' | 'gitlab' | 'bitbucket'> = { 'github.com': 'github', 'gitlab.com': 'gitlab', 'bitbucket.org': 'bitbucket' };
  const provider = providers[url.hostname];
  if (!provider) return null;
  const parts = url.pathname.replace(/\/$/, '').slice(1).split('/');
  if (parts.length < 2 || (provider !== 'gitlab' && parts.length !== 2) || parts.some(part => !/^[A-Za-z0-9_.-]+$/.test(part) || ['.', '..', '-'].includes(part))) return null;
  parts[parts.length - 1] = parts.at(-1)!.replace(/\.git$/, '');
  if (!parts.at(-1)) return null;
  return { provider, base: url.origin + '/' + parts.join('/') };
 } catch { return null; }
}

function safePath(value: unknown): value is string {
 return typeof value === 'string' && value.length > 0 && value.length <= 1024 && file(value) === value
  && !/[\\%?#:\x00-\x20\x7f]/.test(value) && !value.startsWith('/') && !value.endsWith('/')
  && !value.split('/').some(part => !part || part === '.' || part === '..');
}

// These links assert only the owner's exact manifest and explicit path mapping.
// Never fetch source, infer a repository path, or treat a link as provider access.
export function createRepositoryLinker(db: D1Database, project: string) {
 const records = new Map<string, Promise<any>>();
 return async (event: Envelope, lookup: any[], historical = false): Promise<RepositorySourceLink[]> => {
  const all = (reason: Extract<RepositorySourceLink, {status:'unmapped'}>['reason']): RepositorySourceLink[] => event.frames.map(() => ({ status: 'unmapped', reason }));
  if (historical) return all('historical_source_unverified');
  const key = JSON.stringify([event.release, event.build, event.environment]);
  if (!records.has(key)) records.set(key, db.prepare(`SELECT d.repository,d.commit_sha,m.payload FROM deployment_manifests d
   JOIN releases r ON r.project=d.project AND r.name=d.release
   LEFT JOIN deployment_path_mappings m ON m.project=d.project AND m.release=d.release AND m.environment=d.environment AND m.build=r.build
   WHERE d.project=? AND d.release=? AND r.build=? AND d.environment=?`).bind(project, event.release, event.build, event.environment).first());
  const row = await records.get(key);
  if (!row) return all('deployment_unavailable');
  const repo = repository(row.repository);
  if (!repo || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(row.commit_sha)) return all('repository_unsupported');
  if (!row.payload) return all('mapping_unavailable');
  let mappings;
  try { mappings = pathMappings(JSON.parse(row.payload)).sort((a,b) => b.from.length - a.from.length); }
  catch { return all('mapping_invalid'); }
  return event.frames.map((generated, index): RepositorySourceLink => {
   const position = event.language ? generated : lookup[index]?.status === 'mapped' ? lookup[index].original : null;
   if (!position) return { status: 'unmapped', reason: 'original_source_unavailable' };
   const mapping = mappings.find(m => position.file.startsWith(m.from + '/'));
   if (!mapping) return { status: 'unmapped', reason: 'path_unmatched' };
   const suffix = position.file.slice(mapping.from.length + 1), path = mapping.to === '.' ? suffix : mapping.to + '/' + suffix;
   if (!safePath(suffix) || !safePath(path) || !Number.isSafeInteger(position.line) || position.line < 1 || position.line > 10000000) return { status: 'unmapped', reason: 'unsafe_source_path' };
   const encoded = path.split('/').map(encodeURIComponent).join('/'), sha = row.commit_sha;
   const url = repo.provider === 'github' ? `${repo.base}/blob/${sha}/${encoded}#L${position.line}`
    : repo.provider === 'gitlab' ? `${repo.base}/-/blob/${sha}/${encoded}#L${position.line}`
    : `${repo.base}/src/${sha}/${encoded}#lines-${position.line}`;
   return { status: 'linked', url, provider: repo.provider, path, line: position.line, commitSha: sha, source: 'owner_or_deploy_key_recorded', verified: false };
  });
 };
}
