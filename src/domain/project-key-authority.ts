import type { NativeAuthority } from './agent-door/native-authority';

/** Preserve native project-member delegation; read-only and billing confer none. */
export function canManageProjectKey(session: NativeAuthority, kind: string): boolean {
  return ['ingest', 'agent', 'deploy'].includes(kind) && (session.operator.role === 'owner' || session.membership?.role === 'admin'
    || session.membership?.role === 'member' && ['maintainer', 'member'].includes(session.membership.projectRole ?? ''));
}
