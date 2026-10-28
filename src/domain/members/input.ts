import { AuthError } from '../../modules/operator-auth/index.mjs';
import { identity, scrub } from '../privacy';
import { organizationRoles, projectRoles, s, type OrganizationRole, type ProjectRole } from './model';
export const bad = (): never => { throw new AuthError('Invalid membership request',400); };
export function fields(value: any, names: string[]) {
 if (!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!names.includes(key))) bad();
}
export function name(value: unknown): string {
 if (typeof value!=='string'||!value.trim()||value.length>120||/[\x00-\x1f\x7f]/.test(value)) return bad();
 return scrub(value.trim());
}
export function role(value: any): OrganizationRole { if (!organizationRoles.includes(value)) return bad(); return value; }
export function version(value: any): number { if (!Number.isSafeInteger(value)||value<1||value>=Number.MAX_SAFE_INTEGER) return bad(); return value; }
export type Grant = {project:string;role:ProjectRole};
export async function grants(db: D1Database, organization: string, value: any): Promise<Grant[]> {
 if (!Array.isArray(value)||value.length>100) return bad();
 const result: Grant[]=value.map(row=>{fields(row,['project','role']);if(!projectRoles.includes(row.role))bad();return {project:identity(row.project,'project'),role:row.role}});
 if (new Set(result.map(row=>row.project)).size!==result.length) return bad();
 if ((await s(db,'SELECT COUNT(*) total FROM spool_project_teams WHERE organization=? AND project IN (SELECT value FROM json_each(?))',organization,JSON.stringify(result.map(row=>row.project))).first<{total:number}>())?.total!==result.length) throw new AuthError('Project not found',404);
 return result;
}
export const check = (db: D1Database, sql: string, ...args: unknown[]) => s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN ${sql} THEN 1 ELSE 0 END`,...args);
