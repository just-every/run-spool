import { mintedByCurrentPerson } from './credential-fence';
import { mintAdmission } from './dev-credentials';

/** The same current authority used at the credential's transport door. */
export async function credentialStateSql(request: Request) {
 return `CASE WHEN revoked IS NOT NULL THEN 'revoked' WHEN ${mintedByCurrentPerson} AND ${await mintAdmission(request)} THEN 'active' ELSE 'stopped' END`;
}

export async function captureKeyCounts(db: D1Database, request: Request, project: string) {
 const rows=(await db.prepare(`SELECT ${await credentialStateSql(request)} state,COUNT(*) count FROM credentials WHERE project=? AND kind='ingest' GROUP BY state`).bind(project).all<{state:'active'|'stopped'|'revoked';count:number}>()).results;
 const counts={active:0,stopped:0,revoked:0};
 for(const row of rows)counts[row.state]=row.count;
 return counts;
}
