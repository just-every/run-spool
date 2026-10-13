import { devAdmitted } from '../modules/operator-auth/dev-admission.mjs';
// A credential minted while signed in with a dev session is recorded in oa_dev_credentials. Like the dev
// session itself it counts only on a request that passes the local key gate, so a Worker that never
// registers the gate (the deployed one) refuses every dev-minted ingest, agent and deploy key.
const devMinted = "EXISTS(SELECT 1 FROM oa_dev_credentials d WHERE d.credential='credentials' AND d.id=credentials.hash)";
/** SQL condition for a `credentials` lookup made by this request. */
export async function mintAdmission(request: Request): Promise<string> { return (await devAdmitted(request)) ? '1' : `NOT ${devMinted}`; }
export function recordDevMint(db: D1Database, hash: string): D1PreparedStatement {
 return db.prepare("INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('credentials',?,?)").bind(hash, Date.now());
}
