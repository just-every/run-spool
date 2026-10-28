import type { Session } from '../../modules/operator-auth/index.mjs';
export type OrganizationRole = 'admin' | 'billing' | 'member' | 'read-only';
export type ProjectRole = 'maintainer' | 'member' | 'read-only';
export type Membership = { id: string; version: number; role: OrganizationRole; organization: string; project?: string; projectRole?: ProjectRole };
export type TeamSession = (Session | import('../agent-door/native-context').AgentAuthority) & { membership?: Membership };
export const organizationRoles: OrganizationRole[] = ['admin','billing','member','read-only'];
export const projectRoles: ProjectRole[] = ['maintainer','member','read-only'];
export const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
