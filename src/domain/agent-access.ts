import { hash } from './privacy';
import { mintAdmission } from './dev-credentials';
import { mintedByCurrentPerson } from './credential-fence';

/** Only a current, admitted bearer whose minting person is unfenced counts; query parameters are never credentials. */
export async function agentProject(request: Request, db: D1Database): Promise<string | null> {
 const bearer = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
 if (!bearer) return null;
 const grant = await db.prepare(`SELECT project FROM credentials WHERE hash=? AND kind='agent' AND revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(request)}`).bind(await hash(bearer)).first<{ project: string }>();
 return grant?.project ?? null;
}

export function agentReadPath(request: Request, project: string): boolean {
 const method=request.method;
 if (!['GET','POST'].includes(method)) return false;
 const parts = new URL(request.url).pathname.split('/');
 try {
  parts[3] = decodeURIComponent(parts[3]);
  if (parts.length === 7) parts[5] = decodeURIComponent(parts[5]);
 } catch { return false; }
 if (parts[0] !== '' || parts[1] !== 'api' || parts[2] !== 'projects' || parts[3] !== project) return false;
 if(parts.length===5&&parts[4]==='grouping-proposals')return true;
 if(method!=='GET')return false;
 return (parts.length === 5 && ['issues', 'outcomes', 'alerts', 'issue-search', 'issue-export', 'occurrences', 'feedback-reports'].includes(parts[4])) ||
  (parts.length === 7 && parts[4] === 'issues' && /^[a-zA-Z0-9._:-]{1,100}$/.test(parts[5]) && ['packet', 'occurrences'].includes(parts[6]));
}
