import { devAdmitted } from '../modules/operator-auth/dev-admission.mjs';
// Dev provenance survives for every grant. Only the local entry admits project
// ingest/deploy keys without the owner gate; agent reads still need that gate.
// A deployed entry never records a local request and refuses all dev grants.
const localProjectRequests = new WeakSet<Request>();
export function admitLocalProjectKeys(request: Request): void { localProjectRequests.add(request); }
const devMinted = "EXISTS(SELECT 1 FROM oa_dev_credentials d WHERE d.credential='credentials' AND d.id=credentials.hash)";
/** SQL condition for a `credentials` lookup made by this request. */
export async function mintAdmission(request: Request): Promise<string> {
 if (await devAdmitted(request)) return '1';
 return localProjectRequests.has(request) ? `(credentials.kind IN ('ingest','deploy') OR NOT ${devMinted})` : `NOT ${devMinted}`;
}
export function recordDevMint(db: D1Database, hash: string): D1PreparedStatement {
 return db.prepare("INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('credentials',?,?)").bind(hash, Date.now());
}
