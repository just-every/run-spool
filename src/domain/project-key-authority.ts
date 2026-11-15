import type { NativeAuthority } from './agent-door/native-authority';

export function canManageProjectKey(session: NativeAuthority, kind: string): boolean {
  return session.operator.role === 'owner' || session.membership?.role === 'admin' || session.membership?.projectRole === 'maintainer'
    || kind === 'deploy' && session.membership?.role === 'member' && session.membership.projectRole === 'member';
}
