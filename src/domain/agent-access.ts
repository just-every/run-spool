import { agentAuthority,localCredentialId } from './agent-door/context';
import { mintAdmission } from './dev-credentials';
import { credentialDigest, isNonAgentCapture, mintedByCurrentPerson } from './credential-fence';

type Grant = {project:string; mintedBy:string|null};
const currentAgent = `hash=? AND kind='agent' AND revoked IS NULL AND ${mintedByCurrentPerson}`;

/** Only a current, admitted bearer whose minting person is unfenced counts; query parameters are never credentials. */
export async function agentProject(request: Request, db: D1Database): Promise<string | null> {
 const native=agentAuthority(request),clientId=localCredentialId(native?.context.clientId);
 if(!clientId)return isNonAgentCapture(request)?null:(await bearerAgentGrant(request,db))?.project??null;
 const project=agentPathProject(request);
 if(project===null)return null;
 const grant=await db.prepare(`UPDATE credentials SET last_used=? WHERE ${currentAgent} AND project=? RETURNING project`)
  .bind(Date.now(),clientId,project).first<{project:string}>();
 return grant?.project??null;
}

export async function bearerAgentGrant(request: Request, db: D1Database): Promise<(Grant & {id:string}) | null> {
 const bearer = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
 if (!bearer) return null;
 const [id,admission]=await Promise.all([credentialDigest(request,bearer),mintAdmission(request)]);
 const predicate=`${currentAgent} AND ${admission}`;
 const lookup=db.prepare(`SELECT project,minted_by AS mintedBy FROM credentials WHERE ${predicate}`).bind(id);
 const project=agentPathProject(request);
 // Return the current grant even for a disallowed path, so the caller can
 // refuse it explicitly. Mark usage only on the grant's exact project path.
 const grant=project===null?await lookup.first<Grant>():(await db.batch<Grant>([
  lookup,
  db.prepare(`UPDATE credentials SET last_used=? WHERE ${predicate} AND project=?`).bind(Date.now(),id,project),
 ]))[0].results[0];
 return grant?{...grant,id}:null;
}

export function agentReadPath(request: Request, project: string): boolean {
 return agentPathProject(request)===project;
}

function agentPathProject(request: Request): string | null {
 const method=request.method;
 if (!['GET','POST'].includes(method)) return null;
 const parts = new URL(request.url).pathname.split('/');
 try {
  parts[3] = decodeURIComponent(parts[3]);
  if (parts.length === 7) parts[5] = decodeURIComponent(parts[5]);
 } catch { return null; }
 if (parts[0] !== '' || parts[1] !== 'api' || parts[2] !== 'projects') return null;
 if(parts.length===5&&parts[4]==='grouping-proposals')return parts[3];
 if(method!=='GET')return null;
 const allowed = (parts.length === 5 && ['issues', 'outcomes', 'alerts', 'issue-search', 'issue-export', 'occurrences', 'feedback-reports', 'release-health'].includes(parts[4])) ||
  (parts.length === 7 && parts[4] === 'issues' && /^[a-zA-Z0-9._:-]{1,100}$/.test(parts[5]) && ['packet', 'occurrences', 'affected-users'].includes(parts[6]));
 return allowed?parts[3]:null;
}
